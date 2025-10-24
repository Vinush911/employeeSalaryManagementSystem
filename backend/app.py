from flask import Flask, jsonify, request, session
from flask_cors import CORS
from db import get_db_connection
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
import datetime
import os
# --- Add specific import ---
import mysql.connector
# --- Add traceback for debugging ---
import traceback

app = Flask(__name__)
# Use a permanent secret key
app.secret_key = 'your_permanent_secret_key_goes_here_39u2r90'

# === FIX: Explicitly specify the frontend origin ===
CORS(app, supports_credentials=True, origins="http://127.0.0.1:5500")
# === END FIX ===


# --- DECORATOR FOR AUTHENTICATION ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            print("Login required: No user_id in session") # Add log
            return jsonify({"error": "Unauthorized access"}), 401
        # print(f"Login required: User {session.get('user_id')} authenticated.") # Reduce noise
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

# --- NEW: LEAVE CALCULATION HELPER ---
def calculate_leave_days(start_date_str, end_date_str):
    """
    Calculates the number of leave days, excluding weekends (Sat, Sun).
    """
    try:
        start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()

        if end_date < start_date:
            return 0 # Or raise error

        leave_days = 0
        current_date = start_date
        while current_date <= end_date:
            # 5 = Saturday, 6 = Sunday
            if current_date.weekday() not in [5, 6]:
                leave_days += 1
            current_date += datetime.timedelta(days=1)

        return leave_days
    except Exception as e:
        print(f"Error calculating leave days: {e}")
        return 0

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
        # Add 'role' column
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)",
                       (username, hashed_password, 'employee')) # Default new users to 'employee'
        conn.commit()
        return jsonify({"message": "User registered successfully"}), 201
    # Catch specific DB errors
    except mysql.connector.Error as db_err:
        conn.rollback()
        print(f"Database error during registration: {db_err}")
        return jsonify({"error": f"Database error: {db_err.msg}"}), 500
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
        # Select 'role' as well
        cursor.execute("SELECT id, username, password_hash, role FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()

        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            # Store role in session
            session['role'] = user['role']
            print(f"Login successful for user {user['username']}, role: {user['role']}") # Add log
            # Return role to frontend
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
    session.pop('role', None) # Clear role on logout
    print(f"User {user_id} logged out.") # Add log
    return jsonify({"message": "Logged out successfully"})

@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    if 'user_id' in session:
        # Return role
        # print(f"Check-auth: User {session.get('user_id')} IS logged in, role: {session.get('role')}") # Reduce noise
        return jsonify({
            "logged_in": True,
            "username": session.get('username'),
            "role": session.get('role') # Include role
            })
    else:
        # print("Check-auth: User is NOT logged in.") # Reduce noise
        return jsonify({"logged_in": False})

# --- DASHBOARD STATS ROUTE (Admin Only) ---
@app.route('/api/dashboard-stats', methods=['GET'])
@login_required
def get_dashboard_stats():
    # Add role check
    if session.get('role') != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)

    try:
        cursor.execute("SELECT COUNT(*) as total_employees FROM Employee")
        total_employees_result = cursor.fetchone()
        total_employees = total_employees_result['total_employees'] if total_employees_result else 0


        cursor.execute("SELECT COUNT(DISTINCT department) as total_departments FROM Employee")
        total_departments_result = cursor.fetchone()
        total_departments = total_departments_result['total_departments'] if total_departments_result else 0

        cursor.execute("SELECT AVG(base_salary) as average_salary FROM Employee")
        # Handle potential None if no employees exist
        avg_salary_result = cursor.fetchone()
        average_salary = avg_salary_result['average_salary'] if avg_salary_result else 0.0 # Default to 0.0
        average_salary = float(average_salary or 0.0) # Ensure it's float


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
    # --- NEW: Parameter to include linked username ---
    include_linked_user = request.args.get('include_linked_user', 'false').lower() == 'true'


    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)

    try:
        # --- MODIFICATION: Join with users table if requested ---
        if include_linked_user:
             query = """
                 SELECT e.*, u.username as linked_username
                 FROM Employee e
                 LEFT JOIN users u ON e.user_id = u.id
                 WHERE e.name LIKE %s
             """
        else:
             query = "SELECT e.* FROM Employee e WHERE e.name LIKE %s"

        params = [f"%{search_term}%"]

        if department:
            query += " AND e.department = %s"
            params.append(department)

        query += " ORDER BY e.employee_id DESC"

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


# --- NEW: Route to get unlinked users (for dropdown) ---
@app.route('/api/users/unlinked', methods=['GET'])
@login_required
def get_unlinked_users():
     if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

     conn = get_db_connection()
     if conn is None: return jsonify({"error": "Database connection failed"}), 500
     cursor = conn.cursor(dictionary=True, buffered=True)
     try:
         # Select users who are not admin and whose ID is not present in the Employee.user_id column
         query = """
             SELECT u.id, u.username
             FROM users u
             LEFT JOIN Employee e ON u.id = e.user_id
             WHERE u.role != 'admin' AND e.employee_id IS NULL
             ORDER BY u.username;
         """
         cursor.execute(query)
         unlinked_users = cursor.fetchall()
         return jsonify(unlinked_users)
     except Exception as e:
         print(f"Error fetching unlinked users: {e}")
         return jsonify({"error": "Could not fetch unlinked users"}), 500
     finally:
         cursor.close()
         conn.close()


@app.route('/api/employees/<int:employee_id>', methods=['GET'])
@login_required
def get_employee(employee_id):
    # --- MODIFIED: Allow admin or the correct employee ---
    # This check is complex. Let's fetch first, then check.
    # if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    include_linked_user = request.args.get('include_linked_user', 'false').lower() == 'true'

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        if include_linked_user:
            query = """
                SELECT e.*, u.username as linked_username
                FROM Employee e
                LEFT JOIN users u ON e.user_id = u.id
                WHERE e.employee_id = %s
            """
        else:
            # --- MODIFIED: Select user_id for permission check ---
            query = "SELECT e.*, e.user_id FROM Employee e WHERE e.employee_id = %s"

        cursor.execute(query, (employee_id,))
        employee = cursor.fetchone()

        if employee:
            # --- NEW PERMISSION CHECK ---
            is_admin = session.get('role') == 'admin'
            is_correct_employee = (employee.get('user_id') is not None and employee.get('user_id') == session.get('user_id'))

            if not (is_admin or is_correct_employee):
                 print(f"Access DENIED for employee {employee_id} to user {session.get('user_id')}")
                 return jsonify({"error": "Forbidden"}), 403

            # User is authorized, return data
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

    # --- FIX 1: Stricter validation ---
    # Check for None
    if not all(field in new_employee_data and new_employee_data[field] is not None for field in required_fields):
        return jsonify({"error": "Missing required employee fields"}), 400

    # Check for empty strings on key fields
    if any(new_employee_data[field] == '' for field in ['name', 'department', 'position', 'joining_date', 'base_salary']):
        return jsonify({"error": "All fields are required and cannot be empty."}), 400
    # --- END FIX 1 ---

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(buffered=True) # No dictionary needed for insert ID

    try:
        sql = """INSERT INTO Employee
                 (name, department, position, joining_date, base_salary, user_id)
                 VALUES (%s, %s, %s, %s, %s, %s)"""

        # --- FIX 2: No longer need to convert '' to None, as we block it ---
        joining_date = new_employee_data['joining_date']
        user_id_to_link = None # Always add as unlinked initially
        values = (new_employee_data['name'], new_employee_data['department'],
                  new_employee_data['position'], joining_date,
                  new_employee_data['base_salary'], user_id_to_link)
        # --- END FIX 2 ---

        cursor.execute(sql, values)
        conn.commit()
        new_id = cursor.lastrowid
        return jsonify({"message": "Employee added successfully", "employee_id": new_id}), 201
    except mysql.connector.Error as db_err:
        conn.rollback()
        print(f"Database error adding employee: {db_err}")
        return jsonify({"error": f"Database error: {db_err.msg}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Error adding employee: {e}")
        traceback.print_exc()
        return jsonify({"error": "Could not add employee due to an internal error"}), 500
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

    # --- FIX 1: Stricter validation ---
    if not all(field in data and data[field] is not None for field in required_fields):
        return jsonify({"error": "Missing required employee fields"}), 400

    # Check for empty strings on key fields
    if any(data[field] == '' for field in ['name', 'department', 'position', 'joining_date', 'base_salary']):
        return jsonify({"error": "All fields are required and cannot be empty."}), 400
    # --- END FIX 1 ---

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(buffered=True)

    try:
        # Get user_id from payload (can be None or empty string for unlinking)
        user_id_to_link = data.get('user_id')
        # Convert empty string to None for DB
        if user_id_to_link == '':
            user_id_to_link = None
        elif user_id_to_link is not None:
             try:
                 user_id_to_link = int(user_id_to_link) # Ensure it's an int if not None/empty
             except (ValueError, TypeError):
                  return jsonify({"error": "Invalid user_id provided for linking."}), 400

        # --- FIX 2: No longer need to convert '' to None ---
        joining_date = data['joining_date']
        # --- END FIX 2 ---

        sql = """UPDATE Employee SET
                 name = %s, department = %s, position = %s,
                 joining_date = %s, base_salary = %s, user_id = %s
                 WHERE employee_id = %s"""
        values = (data['name'], data['department'], data['position'],
                  joining_date, data['base_salary'], user_id_to_link, employee_id)

        print(f"Updating employee {employee_id} with values: {values}") # Debug log

        cursor.execute(sql, values)
        conn.commit()

        rowcount = cursor.rowcount # Get affected rows before closing cursor

        if rowcount == 0:
            # Check if employee actually exists to differentiate errors
            check_cursor = conn.cursor(buffered=True)
            check_cursor.execute("SELECT employee_id FROM Employee WHERE employee_id = %s", (employee_id,))
            exists = check_cursor.fetchone()
            check_cursor.close()
            if not exists:
                return jsonify({"error": "Employee not found"}), 404
            else:
                # If exists but rowcount is 0, likely no data actually changed
                 print(f"Update executed for employee {employee_id}, but rowcount is 0. Data likely unchanged.")
                 # --- MODIFIED: Return success even if no change ---
                 return jsonify({"message": f"Employee {employee_id} updated successfully (no data changed)"})


        print(f"Successfully updated employee {employee_id}. Rowcount: {rowcount}") # Debug log
        return jsonify({"message": f"Employee {employee_id} updated successfully"})

    except mysql.connector.Error as db_err:
        conn.rollback()
        print(f"Database error updating employee {employee_id}: {db_err}")
        # --- Check specific errors related to user_id linking ---
        if db_err.errno == 1062: # Duplicate entry (e.g., user_id unique constraint violation)
             return jsonify({"error": "Update failed. This user account might already be linked to another employee."}), 409
        if db_err.errno == 1452: # Foreign key constraint fails (user_id doesn't exist in users table)
             return jsonify({"error": "Update failed. The selected user account does not exist."}), 400
        return jsonify({"error": f"Database error: {db_err.msg}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Error updating employee {employee_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "Could not update employee due to an internal error"}), 500
    finally:
        # Ensure cursor is closed even if rowcount check fails
        if cursor: cursor.close()
        if conn: conn.close()


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
        return jsonify({"error": f"Database error: {db_err.msg}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Error deleting employee {employee_id}: {e}")
        return jsonify({"error": "Could not delete employee"}), 500
    finally:
        cursor.close()
        conn.close()

# --- SALARY ROUTES ---

# Get salaries for a specific employee (used by Admin salary page)
@app.route('/api/employees/<int:employee_id>/salaries', methods=['GET'])
@login_required
def get_employee_salaries(employee_id):
    # --- MODIFIED: Allow admin or the correct employee ---
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        # Check if employee exists first
        cursor.execute("SELECT employee_id, user_id FROM Employee WHERE employee_id = %s", (employee_id,))
        employee = cursor.fetchone()
        if not employee:
             return jsonify({"error": "Employee not found"}), 404

        # --- NEW PERMISSION CHECK ---
        is_admin = session.get('role') == 'admin'
        is_correct_employee = (employee.get('user_id') is not None and employee.get('user_id') == session.get('user_id'))

        if not (is_admin or is_correct_employee):
            print(f"Access DENIED for employee {employee_id} salaries to user {session.get('user_id')}")
            return jsonify({"error": "Forbidden"}), 403

        # User is authorized, proceed
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

# Get single salary record (for slip - Employee or Admin)
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

        # Role Check for Salary Slip Access
        logged_in_user_id = session.get('user_id')
        employee_linked_user_id = salary_slip.get('user_id')

        # Allow if admin OR if the employee record linked to this salary
        # is also linked to the currently logged-in user (and user_id is not None)
        if session.get('role') == 'admin' or \
           (session.get('role') == 'employee' and employee_linked_user_id is not None and employee_linked_user_id == logged_in_user_id):
             # print(f"Access granted for salary slip {salary_id} to user {logged_in_user_id} (role: {session.get('role')})") # Reduce noise
             return jsonify(format_dates([salary_slip])[0])
        else:
            print(f"Access DENIED for salary slip {salary_id} to user {logged_in_user_id} (role: {session.get('role')}, linked_id: {employee_linked_user_id})") # Add log
            return jsonify({"error": "Forbidden"}), 403

    except Exception as e:
        print(f"Error getting single salary {salary_id}: {e}")
        traceback.print_exc()
        return jsonify({"error": "Could not fetch salary slip data"}), 500
    finally:
        cursor.close()
        conn.close()


# Helper function for salary calculation
def _calculate_salary_for_employee(cursor, employee_id, base_salary, month, bonus=0.0, deductions=0.0):
    """Calculates and inserts salary. Assumes cursor is dictionary=True, buffered=True."""
    try:
        cursor.execute("SELECT overtime_hours, leaves_taken FROM Attendance WHERE employee_id = %s AND month = %s", (employee_id, month))
        attendance = cursor.fetchone()

        if not attendance: return (False, "Attendance record not found")

        overtime_hours = float(attendance.get('overtime_hours') or 0.0)
        base_salary = float(base_salary or 0.0)

        PF_RATE = 0.12; OT_MULTIPLIER = 1.5; WORKING_DAYS = 22; HOURS_PER_DAY = 8

        pf_amount = round(base_salary * PF_RATE, 2)

        hourly_rate = 0.0
        if base_salary > 0 and WORKING_DAYS > 0 and HOURS_PER_DAY > 0:
             hourly_rate = (base_salary / WORKING_DAYS) / HOURS_PER_DAY
        overtime_pay = round(hourly_rate * overtime_hours * OT_MULTIPLIER, 2)

        sql = """
            INSERT INTO Salary (employee_id, month, overtime_hours, overtime_pay, bonus, deductions, pf_amount)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        values = (employee_id, month, overtime_hours, overtime_pay, float(bonus or 0.0), float(deductions or 0.0), pf_amount)

        cursor.execute(sql, values)
        return (True, None)

    except mysql.connector.Error as db_err:
        print(f"DB Error in _calculate_salary for emp {employee_id}: {db_err}")
        return (False, f"Database error: {db_err.msg}")
    except Exception as e:
        print(f"Error in _calculate_salary for emp {employee_id}: {e}")
        traceback.print_exc()
        return (False, f"Calculation error: {str(e)}")


# Add single salary record (Admin only)
@app.route('/api/salaries', methods=['POST'])
@login_required
def add_salary():
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    required_fields = ['employee_id', 'month', 'bonus', 'deductions']
    if not all(field in data and data[field] is not None for field in required_fields):
        return jsonify({"error": "Missing required salary fields (employee_id, month, bonus, deductions)"}), 400

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
            return jsonify({"error": error_message or "Failed to calculate or add salary record"}), 400

    except Exception as e:
        conn.rollback()
        print(f"Error in POST /api/salaries: {e}")
        traceback.print_exc()
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
    default_bonus = float(data.get('bonus', 0.0)) # Get default bonus

    if not month: return jsonify({"error": "Month is required"}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500

    success_count = 0; failed_count = 0; failed_details = []; run_has_errors = False
    cursor = None # Initialize cursor

    try:
        cursor = conn.cursor(dictionary=True, buffered=True)

        cursor.execute("SELECT employee_id, base_salary FROM Employee")
        employees = cursor.fetchall()
        print(f"Attempting payroll run for month {month} for {len(employees)} employees with default bonus {default_bonus}") # Add log

        for emp in employees:
            employee_id = emp['employee_id']
            base_salary = emp.get('base_salary')

            cursor.execute("SELECT salary_id FROM Salary WHERE employee_id = %s AND month = %s", (employee_id, month))
            if cursor.fetchone():
                failed_count += 1; failed_details.append({"employee_id": employee_id, "reason": "Salary record already exists"}); run_has_errors = True
                print(f"Employee {employee_id}: Skipped - Salary already exists for {month}") # Add log
                continue

            # Pass default_bonus to helper
            success, error_message = _calculate_salary_for_employee(cursor, employee_id, base_salary, month, default_bonus, 0.0)

            if success:
                success_count += 1
                # print(f"Employee {employee_id}: Salary processed successfully for {month}") # Reduce noise
            else:
                failed_count += 1; failed_details.append({"employee_id": employee_id, "reason": error_message}); run_has_errors = True
                print(f"Employee {employee_id}: FAILED - {error_message}") # Add log

        # Atomic commit or rollback
        final_success_count = 0
        if run_has_errors:
            print(f"Payroll run for {month} had errors. Rolling back.") # Add log
            conn.rollback(); final_success_count = 0
        else:
            print(f"Payroll run for {month} successful for {success_count} employees. Committing.") # Add log
            conn.commit(); final_success_count = success_count

        # --- MODIFIED: Return 207 (Multi-Status) if some failed ---
        status_code = 200 # Default to 200
        if run_has_errors:
            if success_count > 0:
                status_code = 207 # Partial success
            else:
                status_code = 400 # Complete failure

        return jsonify({"message": "Payroll run completed.","success_count": final_success_count,"failed_count": failed_count,"failed_details": failed_details}), status_code

    except Exception as e:
        conn.rollback()
        print(f"CRITICAL Error in /api/payroll/run: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal error occurred during payroll run"}), 500
    finally:
        # --- FIX: Ensure cursor is closed in finally ---
        if cursor: cursor.close()
        if conn: conn.close()


# --- ATTENDANCE ROUTES ---

# Get attendance for a specific employee
@app.route('/api/employees/<int:employee_id>/attendance', methods=['GET'])
@login_required
def get_employee_attendance(employee_id):
    # --- MODIFIED: Allow admin or the correct employee ---
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
         # Check if employee exists first
        cursor.execute("SELECT employee_id, user_id FROM Employee WHERE employee_id = %s", (employee_id,))
        employee = cursor.fetchone()
        if not employee:
             return jsonify({"error": "Employee not found"}), 404

        # --- NEW PERMISSION CHECK ---
        is_admin = session.get('role') == 'admin'
        is_correct_employee = (employee.get('user_id') is not None and employee.get('user_id') == session.get('user_id'))

        if not (is_admin or is_correct_employee):
            print(f"Access DENIED for employee {employee_id} attendance to user {session.get('user_id')}")
            return jsonify({"error": "Forbidden"}), 403

        # User is authorized, proceed
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


# Add attendance record
@app.route('/api/attendance', methods=['POST'])
@login_required
def add_attendance():
    if session.get('role') != 'admin': return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    required_fields = ['employee_id', 'month', 'days_present', 'leaves_taken', 'overtime_hours']
    # Check if keys exist and are not None
    if not all(field in data and data[field] is not None for field in required_fields):
        return jsonify({"error": "Missing required attendance fields"}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(buffered=True)

    try:
        # --- MODIFIED: Use INSERT ... ON DUPLICATE KEY UPDATE ---
        # This allows the form to create a new record OR update an existing one
        # (e.g., one created by the leave approval process)
        sql = """
            INSERT INTO Attendance (employee_id, month, days_present, leaves_taken, overtime_hours)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                days_present = VALUES(days_present),
                leaves_taken = VALUES(leaves_taken),
                overtime_hours = VALUES(overtime_hours)
        """
        values = (data['employee_id'], data['month'], data['days_present'], data['leaves_taken'], data['overtime_hours'])

        cursor.execute(sql, values)
        conn.commit()

        # Check if a new row was inserted or an existing one was updated
        if cursor.rowcount == 1:
            return jsonify({"message": "Attendance record created successfully."}), 201
        elif cursor.rowcount == 2: # 2 means an update occurred
            return jsonify({"message": "Attendance record updated successfully."}), 200
        else: # 0 means no change (data was identical)
             return jsonify({"message": "No changes to attendance record."}), 200

    except mysql.connector.Error as db_err:
        conn.rollback()
        print(f"Database error adding attendance: {db_err}")
        # --- FIX: Check for 1452 (Foreign key constraint fail) ---
        if db_err.errno == 1452:
             return jsonify({"error": "Cannot add attendance: Employee ID does not exist."}), 400
        return jsonify({"error": f"Database error: {db_err.msg}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Error adding attendance: {e}")
        traceback.print_exc()
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
        # Ensure average_salary is float
        for row in report_data:
            row['average_salary'] = float(row.get('average_salary') or 0.0)
        return jsonify(report_data)
    except Exception as e:
        print(f"Error in /api/reports/department-salaries: {e}")
        return jsonify({"error": "Could not generate report"}), 500
    finally:
        cursor.close()
        conn.close()


# --- NEW: New Hires Report Route ---
@app.route('/api/reports/new-hires', methods=['GET'])
@login_required
def get_new_hires_report():
    if session.get('role') != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        # Group by the first of the month for clean time-series data
        query = """
            SELECT
                DATE_FORMAT(joining_date, '%%Y-%%m-01') AS hire_month,
                COUNT(employee_id) AS hire_count
            FROM Employee
            WHERE joining_date IS NOT NULL  -- <<<--- This filter is correct
            GROUP BY hire_month
            ORDER BY hire_month ASC;
        """
        cursor.execute(query)
        report_data = cursor.fetchall()

        # We use format_dates to handle the hire_month which is a date object
        # Note: Our query formats it as a string, so format_dates will just pass it through.
        # If we selected `joining_date` directly, format_dates would be essential.
        return jsonify(format_dates(report_data))
    except Exception as e:
        print(f"Error in /api/reports/new-hires: {e}")
        traceback.print_exc()
        return jsonify({"error": "Could not generate new hires report"}), 500
    finally:
        cursor.close()
        conn.close()
# --- END NEW ROUTE ---


# --- NEW: LEAVE MANAGEMENT ROUTES ---

# Employee: Get their own leave requests
@app.route('/api/my-leave-requests', methods=['GET'])
@login_required
def get_my_leave_requests():
    user_id = session.get('user_id')
    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        # Find employee_id from user_id
        cursor.execute("SELECT employee_id FROM Employee WHERE user_id = %s", (user_id,))
        employee = cursor.fetchone()
        if not employee:
            return jsonify({"error": "No employee profile linked to this user."}), 404
        employee_id = employee['employee_id']

        query = "SELECT * FROM LeaveRequest WHERE employee_id = %s ORDER BY requested_on DESC"
        cursor.execute(query, (employee_id,))
        requests = cursor.fetchall()
        return jsonify(format_dates(requests))
    except Exception as e:
        print(f"Error fetching my leave requests: {e}")
        return jsonify({"error": "Could not fetch leave history"}), 500
    finally:
        cursor.close()
        conn.close()

# Employee: Submit a new leave request
@app.route('/api/my-leave-requests', methods=['POST'])
@login_required
def submit_leave_request():
    user_id = session.get('user_id')
    data = request.get_json()
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    reason = data.get('reason')

    if not start_date or not end_date:
        return jsonify({"error": "Start date and end date are required."}), 400

    # --- Basic validation ---
    try:
        start_dt = datetime.datetime.strptime(start_date, '%Y-%m-%d').date()
        end_dt = datetime.datetime.strptime(end_date, '%Y-%m-%d').date()
        if end_dt < start_dt:
             return jsonify({"error": "End date cannot be before start date."}), 400
        # Check that leave is in the same month (simplification)
        if start_dt.strftime('%Y-%m') != end_dt.strftime('%Y-%m'):
            return jsonify({"error": "Leave requests must be within the same calendar month."}), 400
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        # Find employee_id from user_id
        cursor.execute("SELECT employee_id FROM Employee WHERE user_id = %s", (user_id,))
        employee = cursor.fetchone()
        if not employee:
            return jsonify({"error": "No employee profile linked to this user."}), 404
        employee_id = employee['employee_id']

        sql = """
            INSERT INTO LeaveRequest (employee_id, start_date, end_date, reason)
            VALUES (%s, %s, %s, %s)
        """
        cursor.execute(sql, (employee_id, start_date, end_date, reason))
        conn.commit()
        return jsonify({"message": "Leave request submitted successfully."}), 201
    except mysql.connector.Error as db_err:
        conn.rollback()
        print(f"DB error submitting leave: {db_err}")
        return jsonify({"error": f"Database error: {db_err.msg}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Error submitting leave: {e}")
        return jsonify({"error": "Could not submit leave request."}), 500
    finally:
        cursor.close()
        conn.close()

# Admin: Get all leave requests (with filter)
@app.route('/api/leave-requests', methods=['GET'])
@login_required
def get_all_leave_requests():
    if session.get('role') != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    status_filter = request.args.get('status', '') # e.g., 'pending', 'approved'

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        query = """
            SELECT lr.*, e.name as employee_name
            FROM LeaveRequest lr
            JOIN Employee e ON lr.employee_id = e.employee_id
        """
        params = []
        if status_filter:
            query += " WHERE lr.status = %s"
            params.append(status_filter)

        query += " ORDER BY lr.requested_on DESC"

        cursor.execute(query, tuple(params))
        requests = cursor.fetchall()
        return jsonify(format_dates(requests))
    except Exception as e:
        print(f"Error fetching all leave requests: {e}")
        return jsonify({"error": "Could not fetch leave requests"}), 500
    finally:
        cursor.close()
        conn.close()

# Admin: Approve or Deny a leave request
@app.route('/api/leave-requests/<int:request_id>', methods=['PUT'])
@login_required
def update_leave_request(request_id):
    if session.get('role') != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    new_status = data.get('status')

    if new_status not in ['approved', 'denied']:
        return jsonify({"error": "Invalid status. Must be 'approved' or 'denied'."}), 400

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        # First, get the leave request details
        cursor.execute("SELECT * FROM LeaveRequest WHERE request_id = %s", (request_id,))
        leave_request = cursor.fetchone()

        if not leave_request:
            return jsonify({"error": "Leave request not found."}), 404

        if leave_request['status'] != 'pending':
            return jsonify({"error": f"Request has already been {leave_request['status']}."}), 409

        # Update the leave request status
        cursor.execute("UPDATE LeaveRequest SET status = %s WHERE request_id = %s", (new_status, request_id))

        # --- AUTOMATION LOGIC ---
        # If approved, automatically update the Attendance table
        if new_status == 'approved':
            employee_id = leave_request['employee_id']
            # We must format date objects back to strings for the helper
            start_date_str = leave_request['start_date'].strftime('%Y-%m-%d')
            end_date_str = leave_request['end_date'].strftime('%Y-%m-%d')

            # Use helper to calculate BUSINESS days (Mon-Fri)
            leave_days_to_add = calculate_leave_days(start_date_str, end_date_str)

            if leave_days_to_add > 0:
                # We assume leave is in a single month (enforced at submission)
                leave_month = start_date_str[:7] + '-01' # Format as YYYY-MM-01

                # Use INSERT...ON DUPLICATE KEY UPDATE to create or add to the attendance record
                upsert_sql = """
                    INSERT INTO Attendance (employee_id, month, leaves_taken, days_present, overtime_hours)
                    VALUES (%s, %s, %s, 0, 0)
                    ON DUPLICATE KEY UPDATE
                        leaves_taken = leaves_taken + VALUES(leaves_taken)
                """
                cursor.execute(upsert_sql, (employee_id, leave_month, leave_days_to_add))
                print(f"Updated attendance for emp {employee_id}, month {leave_month}, added {leave_days_to_add} leave days.")

        conn.commit()
        return jsonify({"message": f"Leave request {new_status}."})

    except mysql.connector.Error as db_err:
        conn.rollback()
        print(f"DB error updating leave: {db_err}")
        return jsonify({"error": f"Database error: {db_err.msg}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Error updating leave: {e}")
        traceback.print_exc()
        return jsonify({"error": "Could not update leave request."}), 500
    finally:
        cursor.close()
        conn.close()

# --- END NEW LEAVE ROUTES ---


# --- EMPLOYEE DASHBOARD ROUTES ---
@app.route('/api/my-profile', methods=['GET'])
@login_required
def get_my_profile():
    user_id = session.get('user_id')
    # No role check needed here, decorator handles login check

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        cursor.execute("SELECT * FROM Employee WHERE user_id = %s", (user_id,))
        employee_profile = cursor.fetchone()

        if not employee_profile:
            print(f"No employee profile found linked to user_id {user_id}") # Add log
            return jsonify({"error": "No employee profile linked to this user account."}), 404

        # print(f"Found employee profile for user {user_id}: {employee_profile.get('employee_id')}") # Reduce noise
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
    # No role check needed

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        cursor.execute("SELECT employee_id FROM Employee WHERE user_id = %s", (user_id,))
        employee = cursor.fetchone()

        if not employee:
            return jsonify({"error": "No employee profile linked to this user."}), 404

        employee_id = employee['employee_id']
        # print(f"Fetching salaries for employee {employee_id} (linked to user {user_id})") # Reduce noise

        query = "SELECT salary_id, month, total_salary FROM Salary WHERE employee_id = %s ORDER BY month DESC"
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
    # No role check needed

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        cursor.execute("SELECT employee_id FROM Employee WHERE user_id = %s", (user_id,))
        employee = cursor.fetchone()

        if not employee:
            return jsonify({"error": "No employee profile linked to this user."}), 404

        employee_id = employee['employee_id']
        # print(f"Fetching attendance for employee {employee_id} (linked to user {user_id})") # Reduce noise

        query = "SELECT month, days_present, leaves_taken, overtime_hours FROM Attendance WHERE employee_id = %s ORDER BY month DESC"
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
    # Use threaded=True for development server responsiveness
    app.run(debug=True, threaded=True)
