DROP DATABASE IF EXISTS securein_db;
CREATE DATABASE securein_db;
USE securein_db;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'security', 'staff') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
    id INT AUTO_INCREMENT PRIMARY KEY,
    pass_id VARCHAR(10) NOT NULL UNIQUE,
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
    valid_from DATETIME NOT NULL,
    valid_until DATETIME NOT NULL,
    entry_time DATETIME NULL,
    exit_time DATETIME NULL,
    status ENUM('active', 'used', 'expired', 'cancelled') DEFAULT 'active',
    qr_code TEXT NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Students table
CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    registration_number VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    course VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Student entries table
CREATE TABLE student_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    exit_time DATETIME NULL,
    purpose VARCHAR(255),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX idx_pass_id ON entry_passes(pass_id);
CREATE INDEX idx_registration_number ON students(registration_number);
CREATE INDEX idx_event_dates ON events(start_date, end_date);
CREATE INDEX idx_entry_times ON student_entries(entry_time, exit_time);

-- Insert admin user with plain text password 'admin123'
INSERT INTO users (name, email, password, role) VALUES 
('Admin', 'admin@cuk.ac.in', 'admin123', 'admin');
