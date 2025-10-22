import mysql.connector
import os

# This function connects to the MySQL database and returns the connection object.
def get_db_connection():
    """
    Establishes a connection to the MySQL database.
    You MUST update the user and password to match your MySQL setup.
    """
    try:
        conn = mysql.connector.connect(
            host='localhost',          # Your database server address (usually localhost)
            user='root',               # Your MySQL username (often 'root')
            password='Vinush@7022',  # !!! REPLACE WITH YOUR MYSQL PASSWORD !!!
            database='employee_salary_db' # The name of the database we created
        )
        print("MySQL Database connection successful")
        return conn
    except mysql.connector.Error as e:
        print(f"Error connecting to MySQL Database: {e}")
        return None

