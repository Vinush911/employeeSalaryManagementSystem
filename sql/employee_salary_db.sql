-- 1. Create the database
CREATE DATABASE IF NOT EXISTS employee_salary_db;

-- 2. Use the database
USE employee_salary_db;

-- 3. Create the Employee Table
CREATE TABLE Employee (
    employee_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    department VARCHAR(50) NOT NULL,
    position VARCHAR(50) NOT NULL,
    joining_date DATE NOT NULL,
    base_salary FLOAT NOT NULL CHECK (base_salary >= 0)
);

-- 4. Create the Salary Table
CREATE TABLE Salary (
    salary_id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT,
    month DATE NOT NULL, -- Using DATE to store the 1st of the month (e.g., '2025-01-01')
    overtime_hours FLOAT DEFAULT 0,
    overtime_pay FLOAT DEFAULT 0,
    bonus FLOAT DEFAULT 0,
    deductions FLOAT DEFAULT 0,
    pf_amount FLOAT DEFAULT 0,
    total_salary FLOAT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES Employee(employee_id) ON DELETE CASCADE
);

-- 5. Create the Attendance Table (Optional but recommended)
CREATE TABLE Attendance (
    attendance_id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT,
    month DATE NOT NULL, -- Using DATE to store the 1st of the month
    days_present INT DEFAULT 0,
    leaves_taken INT DEFAULT 0,
    overtime_hours FLOAT DEFAULT 0,
    FOREIGN KEY (employee_id) REFERENCES Employee(employee_id) ON DELETE CASCADE
);

-- Confirmation message
SELECT 'Database and tables created successfully' AS Status;


-- 1. Insert sample employees
INSERT INTO Employee (name, department, position, joining_date, base_salary)
VALUES
('Alice Smith', 'Engineering', 'Senior Developer', '2022-03-15', 80000),
('Bob Johnson', 'Sales', 'Sales Manager', '2021-07-01', 65000),
('Charlie Lee', 'Engineering', 'Junior Developer', '2023-01-10', 50000),
('David Brown', 'HR', 'HR Specialist', '2022-11-05', 55000);

-- 2. Insert sample attendance records
INSERT INTO Attendance (employee_id, month, days_present, leaves_taken, overtime_hours)
VALUES
(1, '2025-01-01', 22, 0, 10),
(1, '2025-02-01', 20, 0, 12),
(2, '2025-01-01', 21, 1, 5),
(2, '2025-02-01', 19, 1, 0),
(3, '2025-01-01', 22, 0, 0),
(3, '2025-02-01', 20, 0, 8),
(4, '2025-01-01', 21, 1, 2);

-- 3. Insert sample salary records
-- Note: total_salary is pre-calculated here based on the plan's formula:
-- (Base + Overtime + Bonus - Deductions - PF)
INSERT INTO Salary (employee_id, month, overtime_hours, overtime_pay, bonus, deductions, pf_amount, total_salary)
VALUES
-- Alice (Emp 1)
(1, '2025-01-01', 10, 5000, 2000, 1000, 4000, 82000), -- 80k + 5k + 2k - 1k - 4k
(1, '2025-02-01', 12, 6000, 0, 1000, 4000, 81000),    -- 80k + 6k - 1k - 4k
-- Bob (Emp 2)
(2, '2025-01-01', 5, 2500, 5000, 800, 3000, 68700),   -- 65k + 2.5k + 5k - 0.8k - 3k
(2, '2025-02-01', 0, 0, 0, 800, 3000, 61200),         -- 65k - 0.8k - 3k
-- Charlie (Emp 3)
(3, '2025-01-01', 0, 0, 0, 500, 2500, 47000),         -- 50k - 0.5k - 2.5k
(3, '2025-02-01', 8, 3000, 1000, 500, 2500, 51000),    -- 50k + 3k + 1k - 0.5k - 2.5k
-- David (Emp 4)
(4, '2025-01-01', 2, 1000, 0, 600, 2700, 52700);       -- 55k + 1k - 0.6k - 2.7k

-- Confirmation message
SELECT 'Sample data inserted successfully' AS Status;


-- Query 1: Total salary per employee per month
SELECT 
    e.name, 
    s.month, 
    s.total_salary
FROM Employee e
JOIN Salary s ON e.employee_id = s.employee_id
ORDER BY e.name, s.month;


-- Query 2: Employees with overtime above a threshold (e.g., > 5 hours)
SELECT 
    e.name, 
    s.month, 
    s.overtime_hours
FROM Employee e
JOIN Salary s ON e.employee_id = s.employee_id
WHERE s.overtime_hours > 5;


-- Query 3: Department-wise average total salary (for a specific month)
SELECT 
    e.department,
    AVG(s.total_salary) AS average_monthly_salary
FROM Employee e
JOIN Salary s ON e.employee_id = s.employee_id
WHERE s.month = '2025-01-01'
GROUP BY e.department;


-- Query 4: Monthly salary ranking within each department
SELECT 
    e.name,
    e.department,
    s.month,
    s.total_salary,
    RANK() OVER(
        PARTITION BY e.department, s.month 
        ORDER BY s.total_salary DESC
    ) AS department_salary_rank
FROM Employee e
JOIN Salary s ON e.employee_id = s.employee_id;