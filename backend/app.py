from flask import Flask, jsonify, request, session
from flask_cors import CORS
from db import get_db_connection
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import datetime
import os

app = Flask(__name__)
# Use a permanent secret key
app.secret_key = 'your_permanent_secret_key_goes_here_39u2r90'
CORS(app, supports_credentials=True)

# --- DECORATOR FOR AUTHENTICATION ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            print("Login required: No user_id in session") # Add log
            return jsonify({"error": "Unauthorized access"}), 401
        print(f"Login required: User {session.get('user_id')} authenticated.") # Add log
        return f(*args, **kwargs)
    return decorated_function

# --- DATE FORMATTING HELPER ---
def format_dates(records):
    """Safely formats date objects in a list of dictionaries to YYYY-MM-DD strings."""
    if not records:
        return []
    formatted_records = []
    for record in records:
        new_record = {}
        for key, value in record.items():
            if isinstance(value, datetime.date):
                try:
                    new_record[key] = value.strftime('%Y-%m-%d')
                except ValueError:
                    print(f"Warning: Invalid date encountered for key '{key}': {value}")
                    new_record[key] = None # Or keep original, or handle differently
            else:
                new_record[key] = value
        formatted_records.append(new_record)
    return formatted_records

# --- USER AUTHENTICATION ROUTES ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True) # Use buffered cursor

    try:
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            return jsonify({"error": "Username already exists"}), 409

        hashed_password = generate_password_hash(password)
        # --- FIX: Added 'role' column ---
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)",
                       (username, hashed_password, 'employee')) # Default new users to 'employee'
        conn.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        conn.rollback()
        print(f"Error during registration: {e}")
        return jsonify({"error": "Registration failed"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True) # Use buffered cursor

    try:
        # --- FIX: Select 'role' as well ---
        cursor.execute("SELECT id, username, password_hash, role FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()

        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            # --- FIX: Store role in session ---
            session['role'] = user['role']
            print(f"Login successful for user {user['username']}, role: {user['role']}") # Add log
            # --- FIX: Return role to frontend ---
            return jsonify({"message": "Login successful", "username": user['username'], "role": user['role']})
        else:
            print(f"Login failed for user {username}") # Add log
            return jsonify({"error": "Invalid username or password"}), 401
    except Exception as e:
        print(f"Error during login: {e}")
        return jsonify({"error": "An internal error occurred during login."}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/logout', methods=['POST'])
def logout():
    user_id = session.get('user_id') # Get user_id before popping
    session.pop('user_id', None)
    session.pop('username', None)
    session.pop('role', None) # --- FIX: Clear role on logout ---
    print(f"User {user_id} logged out.") # Add log
    return jsonify({"message": "Logged out successfully"})

@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    if 'user_id' in session:
        # --- FIX: Return role ---
        print(f"Check-auth: User {session.get('user_id')} IS logged in, role: {session.get('role')}") # Add log
        return jsonify({
            "logged_in": True,
            "username": session.get('username'),
            "role": session.get('role') # Include role
            })
    else:
        print("Check-auth: User is NOT logged in.") # Add log
        return jsonify({"logged_in": False})

# --- DASHBOARD STATS ROUTE (Admin Only) ---
@app.route('/api/dashboard-stats', methods=['GET'])
@login_required
def get_dashboard_stats():
    # --- FIX: Add role check ---
    if session.get('role') != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)

    try:
        cursor.execute("SELECT COUNT(*) as total_employees FROM Employee")
        total_employees = cursor.fetchone()['total_employees']

        cursor.execute("SELECT COUNT(DISTINCT department) as total_departments FROM Employee")
        total_departments = cursor.fetchone()['total_departments']

        cursor.execute("SELECT AVG(base_salary) as average_salary FROM Employee")
        # Handle potential None if no employees exist
        avg_salary_result = cursor.fetchone()
        average_salary = avg_salary_result['average_salary'] if avg_salary_result else 0
        average_salary = average_salary or 0 # Ensure it's not None


        return jsonify({
            "total_employees": total_employees,
            "total_departments": total_departments,
            "average_salary": average_salary
        })
    except Exception as e:
        print(f"Error in /api/dashboard-stats: {e}")
        return jsonify({"error": "Could not fetch dashboard stats"}), 500
    finally:
        cursor.close()
        conn.close()

# --- EMPLOYEE MANAGEMENT ROUTES (Admin Only) ---
@app.route('/api/employees', methods=['GET'])
@login_required
def get_employees():
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    search_term = request.args.get('search', '')
    department = request.args.get('department', '')

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)

    try:
        query = "SELECT * FROM Employee WHERE name LIKE %s"
        params = [f"%{search_term}%"]

        if department:
            query += " AND department = %s"
            params.append(department)

        query += " ORDER BY employee_id DESC"

        cursor.execute(query, tuple(params))
        employees = cursor.fetchall()

        cursor.execute("SELECT DISTINCT department FROM Employee ORDER BY department")
        departments_result = cursor.fetchall()
        departments = [row['department'] for row in departments_result if row['department']] # Filter out None/empty

        return jsonify({
            "employees": format_dates(employees),
            "departments": departments
        })
    except Exception as e:
        print(f"Error in /api/employees: {e}")
        return jsonify({"error": "Could not fetch employees"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/employees/<int:employee_id>', methods=['GET'])
@login_required
def get_employee(employee_id):
    # Allow admin OR the employee themselves (if employee_id matches user's linked employee_id)
    # This requires linking user_id to employee_id, which we haven't fully done yet.
    # For now, let's restrict to admin for simplicity in this endpoint.
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        cursor.execute("SELECT * FROM Employee WHERE employee_id = %s", (employee_id,))
        employee = cursor.fetchone()
        if employee:
            return jsonify(format_dates([employee])[0])
        else:
            return jsonify({"error": "Employee not found"}), 404
    except Exception as e:
        print(f"Error getting employee {employee_id}: {e}")
        return jsonify({"error": "Could not fetch employee data"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/employees', methods=['POST'])
@login_required
def add_employee():
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    new_employee_data = request.get_json()
    # Basic validation
    required_fields = ['name', 'department', 'position', 'joining_date', 'base_salary']
    if not all(field in new_employee_data for field in required_fields):
        return jsonify({"error": "Missing required employee fields"}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(buffered=True) # No dictionary needed for insert ID

    try:
        sql = """INSERT INTO Employee
                 (name, department, position, joining_date, base_salary, user_id)
                 VALUES (%s, %s, %s, %s, %s, %s)"""
        # --- FIX: Assume user_id comes from frontend or is handled differently ---
        # For now, inserting NULL - this needs a proper linking mechanism later
        # e.g., create user first, then link, or have a dropdown in Add Employee form.
        user_id_to_link = new_employee_data.get('user_id', None) # Or however you plan to link
        values = (new_employee_data['name'], new_employee_data['department'],
                  new_employee_data['position'], new_employee_data['joining_date'],
                  new_employee_data['base_salary'], user_id_to_link) # Add user_id
        cursor.execute(sql, values)
        conn.commit()
        new_id = cursor.lastrowid
        return jsonify({"message": "Employee added successfully", "employee_id": new_id}), 201
    except mysql.connector.Error as db_err:
        conn.rollback()
        print(f"Database error adding employee: {db_err}")
        # Check for duplicate entry error (e.g., if user_id needs to be unique)
        if db_err.errno == 1062: # Duplicate entry code
             return jsonify({"error": "Could not add employee. Possible duplicate data (e.g., linked user already assigned)."}), 409
        return jsonify({"error": f"Database error: {db_err}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Error adding employee: {e}")
        return jsonify({"error": "Could not add employee"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/employees/<int:employee_id>', methods=['PUT'])
@login_required
def update_employee(employee_id):
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
     # Basic validation
    required_fields = ['name', 'department', 'position', 'joining_date', 'base_salary']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required employee fields"}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(buffered=True)

    try:
        # --- FIX: Update user_id as well if provided ---
        user_id_to_link = data.get('user_id', None) # Allow updating the link
        sql = """UPDATE Employee SET
                 name = %s, department = %s, position = %s,
                 joining_date = %s, base_salary = %s, user_id = %s
                 WHERE employee_id = %s"""
        values = (data['name'], data['department'], data['position'],
                  data['joining_date'], data['base_salary'], user_id_to_link, employee_id)
        cursor.execute(sql, values)
        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "Employee not found or no changes made"}), 404
        return jsonify({"message": f"Employee {employee_id} updated successfully"})
    except mysql.connector.Error as db_err:
        conn.rollback()
        print(f"Database error updating employee {employee_id}: {db_err}")
        if db_err.errno == 1062:
             return jsonify({"error": "Update failed. Possible duplicate data (e.g., linked user already assigned)."}), 409
        return jsonify({"error": f"Database error: {db_err}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Error updating employee {employee_id}: {e}")
        return jsonify({"error": "Could not update employee"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/employees/<int:employee_id>', methods=['DELETE'])
@login_required
def delete_employee(employee_id):
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(buffered=True)
    try:
        # Check if employee exists before deleting
        cursor.execute("SELECT employee_id FROM Employee WHERE employee_id = %s", (employee_id,))
        if not cursor.fetchone():
             return jsonify({"error": "Employee not found"}), 404

        # Proceed with deletion (Salary and Attendance will cascade delete)
        cursor.execute("DELETE FROM Employee WHERE employee_id = %s", (employee_id,))
        conn.commit()
        return jsonify({"message": f"Employee {employee_id} deleted successfully"})
    except mysql.connector.Error as db_err:
        conn.rollback()
        print(f"Database error deleting employee {employee_id}: {db_err}")
        return jsonify({"error": f"Database error: {db_err}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Error deleting employee {employee_id}: {e}")
        return jsonify({"error": "Could not delete employee"}), 500
    finally:
        cursor.close()
        conn.close()

# --- SALARY ROUTES (Admin Only for adding/bulk) ---

# Get salaries for a specific employee (used by Admin salary page)
@app.route('/api/employees/<int:employee_id>/salaries', methods=['GET'])
@login_required
def get_employee_salaries(employee_id):
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        query = """
            SELECT s.*, e.base_salary
            FROM Salary s
            JOIN Employee e ON s.employee_id = e.employee_id
            WHERE s.employee_id = %s
            ORDER BY s.month DESC
        """
        cursor.execute(query, (employee_id,))
        salaries = cursor.fetchall()
        return jsonify(format_dates(salaries))
    except Exception as e:
        print(f"Error getting salaries for employee {employee_id}: {e}")
        return jsonify({"error": "Could not fetch salary history"}), 500
    finally:
        cursor.close()
        conn.close()

# Get single salary record (for slip - potentially Employee or Admin)
@app.route('/api/salaries/<int:salary_id>', methods=['GET'])
@login_required
def get_single_salary(salary_id):
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        query = """
            SELECT s.*, e.name, e.department, e.position, e.base_salary, e.user_id
            FROM Salary s
            JOIN Employee e ON s.employee_id = e.employee_id
            WHERE s.salary_id = %s
        """
        cursor.execute(query, (salary_id,))
        salary_slip = cursor.fetchone()

        if not salary_slip:
            return jsonify({"error": "Salary record not found"}), 404

        # --- FIX: Role Check for Salary Slip Access ---
        # Allow if admin OR if the employee record linked to this salary
        # is also linked to the currently logged-in user.
        logged_in_user_id = session.get('user_id')
        employee_linked_user_id = salary_slip.get('user_id')

        if session.get('role') == 'admin' or (session.get('role') == 'employee' and employee_linked_user_id == logged_in_user_id):
             print(f"Access granted for salary slip {salary_id} to user {logged_in_user_id} (role: {session.get('role')})") # Add log
             return jsonify(format_dates([salary_slip])[0])
        else:
            print(f"Access DENIED for salary slip {salary_id} to user {logged_in_user_id} (role: {session.get('role')})") # Add log
            return jsonify({"error": "Forbidden"}), 403

    except Exception as e:
        print(f"Error getting single salary {salary_id}: {e}")
        return jsonify({"error": "Could not fetch salary slip data"}), 500
    finally:
        cursor.close()
        conn.close()


# Helper function for salary calculation (used by add_salary and run_payroll)
def _calculate_salary_for_employee(cursor, employee_id, base_salary, month, bonus=0.0, deductions=0.0):
    try:
        cursor.execute("SELECT overtime_hours FROM Attendance WHERE employee_id = %s AND month = %s", (employee_id, month))
        attendance = cursor.fetchone()

        if not attendance: return (False, "Attendance record not found")

        overtime_hours = float(attendance.get('overtime_hours') or 0.0)
        base_salary = float(base_salary or 0.0) # Ensure base_salary is float

        PF_RATE = 0.12
        OT_MULTIPLIER = 1.5
        WORKING_DAYS = 22
        HOURS_PER_DAY = 8

        pf_amount = round(base_salary * PF_RATE, 2)

        hourly_rate = 0.0
        if base_salary > 0 and WORKING_DAYS > 0 and HOURS_PER_DAY > 0:
             hourly_rate = (base_salary / WORKING_DAYS) / HOURS_PER_DAY
        overtime_pay = round(hourly_rate * overtime_hours * OT_MULTIPLIER, 2)

        sql = """
            INSERT INTO Salary
            (employee_id, month, overtime_hours, overtime_pay, bonus, deductions, pf_amount)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        # Ensure bonus and deductions are floats
        values = (employee_id, month, overtime_hours, overtime_pay,
                  float(bonus or 0.0), float(deductions or 0.0), pf_amount)

        cursor.execute(sql, values)
        return (True, None)

    except mysql.connector.Error as db_err:
        print(f"DB Error in _calculate_salary for emp {employee_id}: {db_err}")
        # Check specific errors if needed, e.g., foreign key constraint
        return (False, f"Database error: {db_err.msg}")
    except Exception as e:
        print(f"Error in _calculate_salary for emp {employee_id}: {e}")
        # Log the type of error and traceback here for detailed debugging
        import traceback
        traceback.print_exc()
        return (False, f"Calculation error: {str(e)}")


# Add single salary record (Admin only)
@app.route('/api/salaries', methods=['POST'])
@login_required
def add_salary():
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    required_fields = ['employee_id', 'month', 'bonus', 'deductions']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required salary fields"}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)

    try:
        employee_id = data['employee_id']
        month = data['month']
        bonus = data['bonus']
        deductions = data['deductions']

        cursor.execute("SELECT base_salary FROM Employee WHERE employee_id = %s", (employee_id,))
        employee = cursor.fetchone()
        if not employee: return jsonify({"error": "Employee not found"}), 404
        base_salary = employee.get('base_salary')

        cursor.execute("SELECT salary_id FROM Salary WHERE employee_id = %s AND month = %s", (employee_id, month))
        if cursor.fetchone(): return jsonify({"error": "Salary record for this month already exists"}), 409

        success, error_message = _calculate_salary_for_employee(cursor, employee_id, base_salary, month, bonus, deductions)

        if success:
            conn.commit()
            return jsonify({"message": "Salary record calculated and added successfully"}), 201
        else:
            conn.rollback()
            # Provide more specific error if available
            return jsonify({"error": error_message or "Failed to calculate or add salary record"}), 400

    except Exception as e:
        conn.rollback()
        print(f"Error in POST /api/salaries: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        cursor.close()
        conn.close()


# Run bulk payroll (Admin only)
@app.route('/api/payroll/run', methods=['POST'])
@login_required
def run_payroll():
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    month = data.get('month')
    # --- FIX: Get default bonus from request ---
    default_bonus = float(data.get('bonus', 0.0))

    if not month: return jsonify({"error": "Month is required"}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500

    success_count = 0
    failed_count = 0
    failed_details = []
    run_has_errors = False

    try:
        cursor = conn.cursor(dictionary=True, buffered=True)

        cursor.execute("SELECT employee_id, base_salary FROM Employee")
        employees = cursor.fetchall()
        print(f"Attempting payroll run for month {month} for {len(employees)} employees with default bonus {default_bonus}") # Add log

        for emp in employees:
            employee_id = emp['employee_id']
            base_salary = emp.get('base_salary') # Already fetched

            cursor.execute("SELECT salary_id FROM Salary WHERE employee_id = %s AND month = %s", (employee_id, month))
            if cursor.fetchone():
                failed_count += 1
                failed_details.append({"employee_id": employee_id, "reason": "Salary record already exists"})
                run_has_errors = True # Treat existing record as an error for rollback
                print(f"Employee {employee_id}: Skipped - Salary already exists for {month}") # Add log
                continue

            # --- FIX: Pass default_bonus to helper ---
            # Using 0.0 for deductions in bulk run, adjust if needed
            success, error_message = _calculate_salary_for_employee(cursor, employee_id, base_salary, month, default_bonus, 0.0)

            if success:
                success_count += 1
                print(f"Employee {employee_id}: Salary processed successfully for {month}") # Add log
            else:
                failed_count += 1
                failed_details.append({"employee_id": employee_id, "reason": error_message})
                run_has_errors = True
                print(f"Employee {employee_id}: FAILED - {error_message}") # Add log

        # Atomic commit or rollback
        final_success_count = 0
        if run_has_errors:
            print(f"Payroll run for {month} had errors. Rolling back.") # Add log
            conn.rollback()
            final_success_count = 0
        else:
            print(f"Payroll run for {month} successful for {success_count} employees. Committing.") # Add log
            conn.commit()
            final_success_count = success_count

        return jsonify({
            "message": "Payroll run completed.",
            "success_count": final_success_count,
            "failed_count": failed_count,
            "failed_details": failed_details
        }), 200

    except Exception as e:
        conn.rollback()
        print(f"CRITICAL Error in /api/payroll/run: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "An internal error occurred during payroll run"}), 500
    finally:
        cursor.close()
        conn.close()


# --- ATTENDANCE ROUTES (Admin only) ---

# Get attendance for a specific employee (used by Admin attendance page)
@app.route('/api/employees/<int:employee_id>/attendance', methods=['GET'])
@login_required
def get_employee_attendance(employee_id):
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        query = "SELECT * FROM Attendance WHERE employee_id = %s ORDER BY month DESC"
        cursor.execute(query, (employee_id,))
        attendance = cursor.fetchall()
        return jsonify(format_dates(attendance))
    except Exception as e:
        print(f"Error getting attendance for employee {employee_id}: {e}")
        return jsonify({"error": "Could not fetch attendance history"}), 500
    finally:
        cursor.close()
        conn.close()


# Add attendance record (Admin only)
@app.route('/api/attendance', methods=['POST'])
@login_required
def add_attendance():
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    required_fields = ['employee_id', 'month', 'days_present', 'leaves_taken', 'overtime_hours']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required attendance fields"}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(buffered=True)

    try:
        # Check if record already exists for this employee and month
        cursor.execute("SELECT attendance_id FROM Attendance WHERE employee_id = %s AND month = %s",
                       (data['employee_id'], data['month']))
        if cursor.fetchone():
             return jsonify({"error": "Attendance record for this month already exists."}), 409

        sql = """INSERT INTO Attendance
                 (employee_id, month, days_present, leaves_taken, overtime_hours)
                 VALUES (%s, %s, %s, %s, %s)"""
        values = (data['employee_id'], data['month'], data['days_present'],
                  data['leaves_taken'], data['overtime_hours'])
        cursor.execute(sql, values)
        conn.commit()
        return jsonify({"message": "Attendance record added successfully."}), 201
    except mysql.connector.Error as db_err:
        conn.rollback()
        print(f"Database error adding attendance: {db_err}")
        return jsonify({"error": f"Database error: {db_err.msg}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Error adding attendance: {e}")
        return jsonify({"error": "Could not add attendance record"}), 500
    finally:
        cursor.close()
        conn.close()


# --- REPORTING ROUTES (Admin Only) ---
@app.route('/api/reports/department-salaries', methods=['GET'])
@login_required
def get_department_salaries():
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        query = """
            SELECT
                e.department,
                COALESCE(AVG(s.total_salary), 0) AS average_salary,
                COUNT(DISTINCT e.employee_id) AS employee_count
            FROM Employee e
            LEFT JOIN Salary s ON e.employee_id = s.employee_id
            GROUP BY e.department
            ORDER BY average_salary DESC;
        """
        cursor.execute(query)
        report_data = cursor.fetchall()
        # Ensure average_salary is float/number, not Decimal
        for row in report_data:
            if row.get('average_salary') is not None:
                row['average_salary'] = float(row['average_salary'])
            else:
                row['average_salary'] = 0.0

        return jsonify(report_data)
    except Exception as e:
        print(f"Error in /api/reports/department-salaries: {e}")
        return jsonify({"error": "Could not generate report"}), 500
    finally:
        cursor.close()
        conn.close()


# --- NEW ROUTES FOR EMPLOYEE DASHBOARD ---

@app.route('/api/my-profile', methods=['GET'])
@login_required
def get_my_profile():
    user_id = session.get('user_id')
    if not user_id: return jsonify({"error": "Unauthorized"}), 401 # Should be caught by decorator, but safety check

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        # Find the Employee record linked to the logged-in user
        cursor.execute("SELECT * FROM Employee WHERE user_id = %s", (user_id,))
        employee_profile = cursor.fetchone()

        if not employee_profile:
            print(f"No employee profile found linked to user_id {user_id}") # Add log
            # If no direct link, maybe return basic user info or error
            # For now, let's return an error indicating no linked profile
            return jsonify({"error": "No employee profile linked to this user account."}), 404

        print(f"Found employee profile for user {user_id}: {employee_profile.get('employee_id')}") # Add log
        return jsonify(format_dates([employee_profile])[0])
    except Exception as e:
        print(f"Error fetching profile for user {user_id}: {e}")
        return jsonify({"error": "Could not fetch profile data"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/my-salaries', methods=['GET'])
@login_required
def get_my_salaries():
    user_id = session.get('user_id')
    if not user_id: return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        # Find the employee_id linked to the user_id first
        cursor.execute("SELECT employee_id FROM Employee WHERE user_id = %s", (user_id,))
        employee = cursor.fetchone()

        if not employee:
            return jsonify({"error": "No employee profile linked to this user."}), 404

        employee_id = employee['employee_id']
        print(f"Fetching salaries for employee {employee_id} (linked to user {user_id})") # Add log

        # Now fetch salaries for that employee_id
        query = """
            SELECT salary_id, month, total_salary
            FROM Salary
            WHERE employee_id = %s
            ORDER BY month DESC
        """
        cursor.execute(query, (employee_id,))
        salaries = cursor.fetchall()
        return jsonify(format_dates(salaries))
    except Exception as e:
        print(f"Error fetching salaries for user {user_id}: {e}")
        return jsonify({"error": "Could not fetch salary history"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/my-attendance', methods=['GET'])
@login_required
def get_my_attendance():
    user_id = session.get('user_id')
    if not user_id: return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        # Find the employee_id linked to the user_id
        cursor.execute("SELECT employee_id FROM Employee WHERE user_id = %s", (user_id,))
        employee = cursor.fetchone()

        if not employee:
            return jsonify({"error": "No employee profile linked to this user."}), 404

        employee_id = employee['employee_id']
        print(f"Fetching attendance for employee {employee_id} (linked to user {user_id})") # Add log

        # Fetch attendance for that employee_id
        query = """
            SELECT month, days_present, leaves_taken, overtime_hours
            FROM Attendance
            WHERE employee_id = %s
            ORDER BY month DESC
        """
        cursor.execute(query, (employee_id,))
        attendance = cursor.fetchall()
        return jsonify(format_dates(attendance))
    except Exception as e:
        print(f"Error fetching attendance for user {user_id}: {e}")
        return jsonify({"error": "Could not fetch attendance history"}), 500
    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    # Add host='0.0.0.0' to make it accessible on your network if needed
    # Use threaded=True for better handling of concurrent requests during development
    app.run(debug=True, threaded=True) # Added threaded=True

