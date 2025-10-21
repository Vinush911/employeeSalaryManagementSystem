# We need to import 'request' to access the data sent to the server
from flask import Flask, jsonify, request
from flask_cors import CORS
from db import get_db_connection

app = Flask(__name__)
CORS(app)

# --- GET ALL EMPLOYEES (No changes here) ---
@app.route('/api/employees', methods=['GET'])
def get_employees():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM Employee ORDER BY employee_id DESC")
    employees = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(employees)

# --- ADD A NEW EMPLOYEE (This is the new part) ---
@app.route('/api/employees', methods=['POST'])
def add_employee():
    # Get the data sent from the frontend form (it will be in JSON format)
    new_employee = request.get_json()

    # Basic validation to ensure we have all the data
    if not new_employee or not all(k in new_employee for k in ('name', 'department', 'position', 'joining_date', 'base_salary')):
        return jsonify({"error": "Missing data"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor()
    
    # The SQL query to insert a new row into the Employee table
    sql = """INSERT INTO Employee (name, department, position, joining_date, base_salary) 
             VALUES (%s, %s, %s, %s, %s)"""
    
    # The values to insert, taken from the JSON data
    values = (
        new_employee['name'],
        new_employee['department'],
        new_employee['position'],
        new_employee['joining_date'],
        new_employee['base_salary']
    )

    try:
        cursor.execute(sql, values)
        # conn.commit() is crucial - it saves the changes to the database
        conn.commit()
        # Get the ID of the new employee we just created
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()
        # Send a success response back to the frontend
        return jsonify({"message": "Employee added successfully", "employee_id": new_id}), 201
    except Exception as e:
        # If anything goes wrong, we don't save the changes
        conn.rollback()
        cursor.close()
        conn.close()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

