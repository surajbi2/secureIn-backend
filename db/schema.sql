-- Drop database if exists and create new one
DROP DATABASE IF EXISTS securein_db;
CREATE DATABASE securein_db;
USE securein_db;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'security', 'staff') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    venue VARCHAR(255) NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    event_type ENUM('seminar', 'conference', 'workshop', 'other') NOT NULL,
    max_participants INT,
    status ENUM('upcoming', 'ongoing', 'completed', 'cancelled') DEFAULT 'upcoming',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Entry passes table
CREATE TABLE entry_passes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pass_id VARCHAR(10) UNIQUE NOT NULL,
    visitor_name VARCHAR(255) NOT NULL,
    visitor_phone VARCHAR(20) NOT NULL,
    visit_type ENUM('event_guest', 'parent_visit') NOT NULL,
    id_type VARCHAR(50) NOT NULL,
    id_number VARCHAR(100) NOT NULL,
    event_id INT,
    student_name VARCHAR(255),
    relation_to_student VARCHAR(100),
    department VARCHAR(255),
    purpose VARCHAR(255) NOT NULL,
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    entry_time TIMESTAMP NULL,
    exit_time TIMESTAMP NULL,
    status ENUM('active', 'used', 'expired', 'cancelled') DEFAULT 'active',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Students table
CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    course VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student entries table
CREATE TABLE student_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exit_time TIMESTAMP NULL,
    purpose VARCHAR(255),
    created_by INT,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Staff table
CREATE TABLE staff (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff entries table
CREATE TABLE staff_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    staff_id INT NOT NULL,
    entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exit_time TIMESTAMP NULL,
    purpose VARCHAR(255),
    created_by INT,
    FOREIGN KEY (staff_id) REFERENCES staff(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Vehicles table
CREATE TABLE vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    vehicle_type ENUM('two_wheeler', 'four_wheeler', 'other') NOT NULL,
    owner_type ENUM('student', 'staff', 'visitor') NOT NULL,
    owner_id INT NOT NULL,
    make_model VARCHAR(100),
    color VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle entries table
CREATE TABLE vehicle_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_id INT NOT NULL,
    entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exit_time TIMESTAMP NULL,
    purpose VARCHAR(255),
    created_by INT,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
