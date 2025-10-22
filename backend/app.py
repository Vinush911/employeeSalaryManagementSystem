from flask import Flask, jsonify, request, session
from flask_cors import CORS
from db import get_db_connection
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import datetime
import os

app = Flask(__name__)
app.secret_key = os.urandom(24) 
CORS(app, supports_credentials=True)

# --- DECORATOR FOR AUTHENTICATION ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Unauthorized access"}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- DATE FORMATTING HELPER ---
def format_dates(records):
    for record in records:
        for key, value in record.items():
            if isinstance(value, datetime.date):
                record[key] = value.strftime('%Y-%m-%d')
    return records

# --- USER AUTHENTICATION ROUTES ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password: return jsonify({"error": "Username and password are required"}), 400
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    if cursor.fetchone(): return jsonify({"error": "Username already exists"}), 409
    hashed_password = generate_password_hash(password)
    cursor.execute("INSERT INTO users (username, password_hash) VALUES (%s, %s)", (username, hashed_password))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id'] 
        session['username'] = user['username']
        return jsonify({"message": "Login successful", "username": user['username']})
    else:
        return jsonify({"error": "Invalid username or password"}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    return jsonify({"message": "Logged out successfully"})

@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    if 'user_id' in session:
        return jsonify({"logged_in": True, "username": session.get('username')})
    return jsonify({"logged_in": False})

# --- NEW: DASHBOARD STATS ROUTE ---
@app.route('/api/dashboard-stats', methods=['GET'])
@login_required
def get_dashboard_stats():
    try:
        conn = get_db_connection()
        if conn is None: return jsonify({"error": "Database connection failed"}), 500
        cursor = conn.cursor(dictionary=True)

        # Query for total employees
        cursor.execute("SELECT COUNT(*) as total_employees FROM Employee")
        total_employees = cursor.fetchone()['total_employees']

        # Query for total departments
        cursor.execute("SELECT COUNT(DISTINCT department) as total_departments FROM Employee")
        total_departments = cursor.fetchone()['total_departments']

        # Query for average salary
        cursor.execute("SELECT AVG(base_salary) as average_salary FROM Employee")
        average_salary = cursor.fetchone()['average_salary'] or 0

        cursor.close()
        conn.close()

        return jsonify({
            "total_employees": total_employees,
            "total_departments": total_departments,
            "average_salary": average_salary
        })
    except Exception as e:
        print(f"Error in /api/dashboard-stats: {e}")
        return jsonify({"error": "Could not fetch dashboard stats"}), 500

# --- PROTECTED DATA ROUTES ---
# ... (All other existing routes for employees, salaries, attendance, reports remain the same) ...
@app.route('/api/employees', methods=['GET'])
@login_required
def get_employees():
    search_term = request.args.get('search', '')
    department = request.args.get('department', '')
    
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True)
    
    query = "SELECT * FROM Employee WHERE name LIKE %s"
    params = [f"%{search_term}%"]

    if department:
        query += " AND department = %s"
        params.append(department)
        
    query += " ORDER BY employee_id DESC"
    
    cursor.execute(query, tuple(params))
    employees = cursor.fetchall()
    
    # Get unique departments
    cursor.execute("SELECT DISTINCT department FROM Employee ORDER BY department")
    departments = [row['department'] for row in cursor.fetchall()]

    cursor.close()
    conn.close()
    
    return jsonify({
        "employees": format_dates(employees),
        "departments": departments
    })
@app.route('/api/employees/<int:employee_id>', methods=['GET'])
@login_required
def get_employee(employee_id):
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM Employee WHERE employee_id = %s", (employee_id,))
    employee = cursor.fetchone()
    cursor.close()
    conn.close()
    if employee:
        return jsonify(format_dates([employee])[0])
    else:
        return jsonify({"error": "Employee not found"}), 404

@app.route('/api/employees', methods=['POST'])
@login_required
def add_employee():
    new_employee = request.get_json()
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor()
    sql = "INSERT INTO Employee (name, department, position, joining_date, base_salary) VALUES (%s, %s, %s, %s, %s)"
    values = (new_employee['name'], new_employee['department'], new_employee['position'], new_employee['joining_date'], new_employee['base_salary'])
    cursor.execute(sql, values)
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return jsonify({"message": "Employee added successfully", "employee_id": new_id}), 201

@app.route('/api/employees/<int:employee_id>', methods=['PUT'])
@login_required
def update_employee(employee_id):
    data = request.get_json()
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor()
    sql = "UPDATE Employee SET name = %s, department = %s, position = %s, joining_date = %s, base_salary = %s WHERE employee_id = %s"
    values = (data['name'], data['department'], data['position'], data['joining_date'], data['base_salary'], employee_id)
    cursor.execute(sql, values)
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": f"Employee {employee_id} updated successfully"})

@app.route('/api/employees/<int:employee_id>', methods=['DELETE'])
@login_required
def delete_employee(employee_id):
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor()
    cursor.execute("DELETE FROM Employee WHERE employee_id = %s", (employee_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": f"Employee with ID {employee_id} deleted successfully"})

@app.route('/api/employees/<int:employee_id>/salaries', methods=['GET'])
@login_required
def get_employee_salaries(employee_id):
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True)
    query = "SELECT s.*, e.base_salary FROM Salary s JOIN Employee e ON s.employee_id = e.employee_id WHERE s.employee_id = %s ORDER BY s.month DESC"
    cursor.execute(query, (employee_id,))
    salaries = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(format_dates(salaries))
    
@app.route('/api/salaries/<int:salary_id>', methods=['GET'])
@login_required
def get_single_salary(salary_id):
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT s.*, e.name, e.department, e.position, e.base_salary
        FROM Salary s
        JOIN Employee e ON s.employee_id = e.employee_id
        WHERE s.salary_id = %s
    """
    cursor.execute(query, (salary_id,))
    salary_slip = cursor.fetchone()
    cursor.close()
    conn.close()
    if salary_slip:
        return jsonify(format_dates([salary_slip])[0])
    else:
        return jsonify({"error": "Salary record not found"}), 404

@app.route('/api/salaries', methods=['POST'])
@login_required
def add_salary():
    data = request.get_json()
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor()
    sql = "INSERT INTO Salary (employee_id, month, overtime_hours, overtime_pay, bonus, deductions, pf_amount) VALUES (%s, %s, %s, %s, %s, %s, %s)"
    values = (data['employee_id'], data['month'], data.get('overtime_hours', 0), data['overtime_pay'], data['bonus'], data['deductions'], data['pf_amount'])
    cursor.execute(sql, values)
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "Salary record added successfully"}), 201

@app.route('/api/employees/<int:employee_id>/attendance', methods=['GET'])
@login_required
def get_employee_attendance(employee_id):
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True)
    query = "SELECT * FROM Attendance WHERE employee_id = %s ORDER BY month DESC"
    cursor.execute(query, (employee_id,))
    attendance = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(format_dates(attendance))

@app.route('/api/attendance', methods=['POST'])
@login_required
def add_attendance():
    data = request.get_json()
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor()
    sql = "INSERT INTO Attendance (employee_id, month, days_present, leaves_taken, overtime_hours) VALUES (%s, %s, %s, %s, %s)"
    values = (data['employee_id'], data['month'], data['days_present'], data['leaves_taken'], data['overtime_hours'])
    cursor.execute(sql, values)
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "Attendance record added successfully"}), 201

@app.route('/api/reports/department-salaries', methods=['GET'])
@login_required
def get_department_salaries():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT 
                e.department,
                AVG(s.total_salary) AS average_salary,
                COUNT(DISTINCT e.employee_id) AS employee_count
            FROM Employee e
            JOIN Salary s ON e.employee_id = s.employee_id
            GROUP BY e.department
            ORDER BY average_salary DESC;
        """
        cursor.execute(query)
        report_data = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(report_data)
    except Exception as e:
        print(f"Error in /api/reports/department-salaries: {e}")
        return jsonify({"error": "Could not generate report"}), 500
        
if __name__ == '__main__':
    app.run(debug=True)

