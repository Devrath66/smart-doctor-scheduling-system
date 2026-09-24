CREATE DATABASE IF NOT EXISTS clinic_scheduler;
USE clinic_scheduler;
CREATE TABLE IF NOT EXISTS Users(user_id INT AUTO_INCREMENT PRIMARY KEY,full_name VARCHAR(100) NOT NULL,email VARCHAR(150) NOT NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,role ENUM('patient','doctor','admin') NOT NULL,created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS Specializations(specialization_id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(100) NOT NULL UNIQUE,description VARCHAR(255));
CREATE TABLE IF NOT EXISTS Patients(patient_id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL UNIQUE,date_of_birth DATE NOT NULL,gender VARCHAR(20),phone VARCHAR(15) NOT NULL,address VARCHAR(255),FOREIGN KEY(user_id) REFERENCES Users(user_id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS Doctors(doctor_id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL UNIQUE,specialization_id INT NOT NULL,license_no VARCHAR(50) NOT NULL UNIQUE,years_experience INT DEFAULT 0,consultation_fee DECIMAL(8,2),avg_rating DECIMAL(3,2) DEFAULT 5.00,daily_capacity INT DEFAULT 8,FOREIGN KEY(user_id) REFERENCES Users(user_id) ON DELETE CASCADE,FOREIGN KEY(specialization_id) REFERENCES Specializations(specialization_id));
CREATE TABLE IF NOT EXISTS Doctor_Availability(availability_id INT AUTO_INCREMENT PRIMARY KEY,doctor_id INT NOT NULL,day_of_week TINYINT NOT NULL,start_time TIME NOT NULL,end_time TIME NOT NULL,slot_duration_min INT DEFAULT 30,is_active BOOLEAN DEFAULT TRUE,FOREIGN KEY(doctor_id) REFERENCES Doctors(doctor_id) ON DELETE CASCADE,CHECK(end_time>start_time));
CREATE TABLE IF NOT EXISTS Appointments(appointment_id INT AUTO_INCREMENT PRIMARY KEY,patient_id INT NOT NULL,doctor_id INT NOT NULL,availability_id INT NOT NULL,appointment_date DATE NOT NULL,start_time TIME NOT NULL,end_time TIME NOT NULL,status ENUM('booked','completed','cancelled','rescheduled') DEFAULT 'booked',is_emergency BOOLEAN DEFAULT FALSE,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(patient_id) REFERENCES Patients(patient_id) ON DELETE RESTRICT,FOREIGN KEY(doctor_id) REFERENCES Doctors(doctor_id) ON DELETE RESTRICT,FOREIGN KEY(availability_id) REFERENCES Doctor_Availability(availability_id),UNIQUE KEY uq_doctor_slot(doctor_id,appointment_date,start_time),CHECK(end_time>start_time));
ALTER TABLE Appointments ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT FALSE;
CREATE INDEX idx_doctor_specialization ON Doctors(specialization_id); CREATE INDEX idx_appt_doctor_date ON Appointments(doctor_id,appointment_date,start_time); CREATE INDEX idx_appt_patient ON Appointments(patient_id); CREATE INDEX idx_availability_doctor_day ON Doctor_Availability(doctor_id,day_of_week);
INSERT IGNORE INTO Specializations(name,description) VALUES('Cardiology','Heart and cardiovascular care'),('Dermatology','Skin, hair and nail care'),('General Medicine','Primary care and prevention'),('Orthopedics','Bones, joints and movement'),('Pediatrics','Healthcare for children');

INSERT IGNORE INTO Users(user_id,full_name,email,password_hash,role) VALUES
(1,'Dr. Arjun Sharma','arjun.sharma@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(2,'Dr. Priya Verma','priya.verma@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(3,'Avery Johnson','patient@northstar.test','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','patient');
INSERT IGNORE INTO Doctors(user_id,specialization_id,license_no,years_experience,consultation_fee,avg_rating,daily_capacity)
SELECT 1,specialization_id,'LIC-MC-001',12,900.00,4.90,8 FROM Specializations WHERE name='Cardiology';
INSERT IGNORE INTO Doctors(user_id,specialization_id,license_no,years_experience,consultation_fee,avg_rating,daily_capacity)
SELECT 2,specialization_id,'LIC-EM-001',8,700.00,4.70,8 FROM Specializations WHERE name='Cardiology';
INSERT IGNORE INTO Users(user_id,full_name,email,password_hash,role) VALUES
(39,'Dr. Vivek Kulkarni','vivek.kulkarni@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(40,'Dr. Nandini Deshmukh','nandini.deshmukh@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(41,'Dr. Sameer Kulkarni','sameer.kulkarni@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(42,'Dr. Isha Kapoor','isha.kapoor@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(43,'Dr. Harsh Vardhan','harsh.vardhan@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(44,'Dr. Tanvi Reddy','tanvi.reddy@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(45,'Dr. Mohit Sethi','mohit.sethi@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(46,'Dr. Aditi Bhatia','aditi.bhatia@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor');
INSERT IGNORE INTO Doctors(user_id,specialization_id,license_no,years_experience,consultation_fee,avg_rating,daily_capacity)
SELECT u.user_id,s.specialization_id,CONCAT('LIC-',u.user_id),
6+(u.user_id MOD 12),700+(u.user_id MOD 5)*100,4.50+(u.user_id MOD 5)/10,12
FROM Users u JOIN Specializations s ON s.name=CASE u.user_id
WHEN 39 THEN 'Cardiology' WHEN 40 THEN 'Dermatology'
WHEN 41 THEN 'General Medicine' WHEN 42 THEN 'Orthopedics'
WHEN 43 THEN 'Pediatrics' WHEN 44 THEN 'Neurology'
WHEN 45 THEN 'Gastroenterology' WHEN 46 THEN 'Ophthalmology' END
WHERE u.user_id BETWEEN 39 AND 46;
UPDATE Users SET email = CONCAT(LOWER(REPLACE(REPLACE(full_name, 'Dr. ', ''), ' ', '.')), '@dkhospital.com') WHERE role = 'doctor';
INSERT IGNORE INTO Doctor_Availability(doctor_id,day_of_week,start_time,end_time,slot_duration_min)
SELECT d.doctor_id,days.day_of_week,'09:00:00','17:00:00',30
FROM Doctors d JOIN (SELECT 0 day_of_week UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) days ON 1=1
WHERE d.user_id BETWEEN 39 AND 46;
INSERT IGNORE INTO Patients(user_id,date_of_birth,phone,address) VALUES(3,'1992-04-18','5550100100','14 Cedar Street');
INSERT IGNORE INTO Doctor_Availability(doctor_id,day_of_week,start_time,end_time,slot_duration_min)
SELECT doctor_id,1,'09:00:00','13:00:00',30 FROM Doctors WHERE user_id IN (1,2);
INSERT IGNORE INTO Doctor_Availability(doctor_id,day_of_week,start_time,end_time,slot_duration_min)
SELECT doctor_id,3,'14:00:00','18:00:00',30 FROM Doctors WHERE user_id IN (1,2);
INSERT IGNORE INTO Doctor_Availability(doctor_id,day_of_week,start_time,end_time,slot_duration_min)
SELECT doctor_id,2,'09:00:00','13:00:00',30 FROM Doctors WHERE user_id IN (1,2);
INSERT IGNORE INTO Doctor_Availability(doctor_id,day_of_week,start_time,end_time,slot_duration_min)
SELECT doctor_id,4,'09:00:00','13:00:00',30 FROM Doctors WHERE user_id IN (1,2);
INSERT IGNORE INTO Doctor_Availability(doctor_id,day_of_week,start_time,end_time,slot_duration_min)
SELECT doctor_id,5,'09:00:00','13:00:00',30 FROM Doctors WHERE user_id IN (1,2);
INSERT IGNORE INTO Doctor_Availability(doctor_id,day_of_week,start_time,end_time,slot_duration_min)
SELECT doctor_id,6,'09:00:00','13:00:00',30 FROM Doctors WHERE user_id IN (1,2);
DROP VIEW IF EXISTS Doctor_Daily_Load;
CREATE VIEW Doctor_Daily_Load AS SELECT doctor_id,appointment_date,COUNT(*) booked_count FROM Appointments WHERE status='booked' GROUP BY doctor_id,appointment_date;
DROP VIEW IF EXISTS Doctor_Directory;
CREATE VIEW Doctor_Directory AS SELECT d.doctor_id,u.full_name,u.email,s.name specialization,d.years_experience,d.consultation_fee,d.avg_rating,d.daily_capacity FROM Doctors d JOIN Users u ON u.user_id=d.user_id JOIN Specializations s ON s.specialization_id=d.specialization_id;

INSERT IGNORE INTO Specializations(name,description) VALUES
('Neurology','Brain, spine and nervous system care'),('Oncology','Cancer diagnosis and treatment'),('Gastroenterology','Digestive system care'),('Endocrinology','Hormones and metabolic health'),('Psychiatry','Mental health and behavioral care'),('Ophthalmology','Eye and vision care'),('Otolaryngology','Ear, nose and throat care'),('Urology','Urinary tract and men\'s health'),('Gynecology','Women\'s reproductive health'),('Pulmonology','Lung and respiratory care'),('Nephrology','Kidney care'),('Emergency Medicine','Urgent and emergency care');
INSERT IGNORE INTO Users(user_id,full_name,email,password_hash,role) VALUES
(4,'Dr. Rahul Mehta','rahul.mehta@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(5,'Dr. Neha Gupta','neha.gupta@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(6,'Dr. Vikram Singh','vikram.singh@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(7,'Dr. Ananya Patel','ananya.patel@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(8,'Dr. Rohan Joshi','rohan.joshi@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(9,'Dr. Kavya Iyer','kavya.iyer@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(10,'Dr. Aditya Kapoor','aditya.kapoor@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(11,'Dr. Sneha Nair','sneha.nair@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(12,'Dr. Karan Malhotra','karan.malhotra@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(13,'Dr. Pooja Mishra','pooja.mishra@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(14,'Dr. Amit Agarwal','amit.agarwal@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(15,'Dr. Shreya Saxena','shreya.saxena@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(16,'Dr. Saurabh Tiwari','saurabh.tiwari@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(17,'Dr. Ritu Choudhary','ritu.choudhary@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(18,'Dr. Manish Bansal','manish.bansal@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(19,'Dr. Divya Srivastava','divya.srivastava@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(20,'Dr. Nitin Jain','nitin.jain@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(21,'Dr. Meenakshi Rao','meenakshi.rao@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(22,'Dr. Abhishek Yadav','abhishek.yadav@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(23,'Dr. Simran Kaur','simran.kaur@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(24,'Dr. Deepak Sharma','deepak.sharma@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(25,'Dr. Shalini Gupta','shalini.gupta@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(26,'Dr. Rajesh Patel','rajesh.patel@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),(27,'Dr. Ayesha Khan','ayesha.khan@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor');
INSERT IGNORE INTO Doctors(user_id,specialization_id,license_no,years_experience,consultation_fee,avg_rating,daily_capacity)
SELECT u.user_id,s.specialization_id,CONCAT('LIC-',u.user_id),5+(u.user_id MOD 16),(600+(u.user_id MOD 6)*75)*15,4.40+(u.user_id MOD 6)/10,12 FROM Users u JOIN Specializations s ON s.name=CASE u.user_id
WHEN 4 THEN 'Neurology' WHEN 5 THEN 'Neurology' WHEN 6 THEN 'Oncology' WHEN 7 THEN 'Oncology' WHEN 8 THEN 'Gastroenterology' WHEN 9 THEN 'Gastroenterology' WHEN 10 THEN 'Endocrinology' WHEN 11 THEN 'Endocrinology' WHEN 12 THEN 'Psychiatry' WHEN 13 THEN 'Psychiatry' WHEN 14 THEN 'Ophthalmology' WHEN 15 THEN 'Ophthalmology' WHEN 16 THEN 'Otolaryngology' WHEN 17 THEN 'Otolaryngology' WHEN 18 THEN 'Urology' WHEN 19 THEN 'Urology' WHEN 20 THEN 'Gynecology' WHEN 21 THEN 'Gynecology' WHEN 22 THEN 'Pulmonology' WHEN 23 THEN 'Pulmonology' WHEN 24 THEN 'Nephrology' WHEN 25 THEN 'Nephrology' WHEN 26 THEN 'Emergency Medicine' WHEN 27 THEN 'Emergency Medicine' END;
INSERT IGNORE INTO Doctor_Availability(doctor_id,day_of_week,start_time,end_time,slot_duration_min)
SELECT d.doctor_id,days.day_of_week,'08:00:00','20:00:00',30 FROM Doctors d JOIN (SELECT 0 day_of_week UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) days ON 1=1 WHERE d.user_id>=4;
INSERT IGNORE INTO Users(user_id,full_name,email,password_hash,role) VALUES
(28,'Jordan Carter','jordan.carter@northstar.test','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','patient'),(29,'Riley Phillips','riley.phillips@northstar.test','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','patient'),(30,'Casey Evans','casey.evans@northstar.test','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','patient'),(31,'Morgan Edwards','morgan.edwards@northstar.test','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','patient'),(32,'Taylor Collins','taylor.collins@northstar.test','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','patient'),(33,'Cameron Stewart','cameron.stewart@northstar.test','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','patient'),(34,'Quinn Sanchez','quinn.sanchez@northstar.test','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','patient'),(35,'Alex Morris','alex.morris@northstar.test','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','patient'),(36,'Jamie Rogers','jamie.rogers@northstar.test','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','patient'),(37,'Drew Reed','drew.reed@northstar.test','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','patient'),(38,'Clinic Administrator','admin@northstar.test','$2b$10$ImR7XcolOv2EGdnxrP9NJe40QYm45bM2yqvopOIu3KDVqQP3WJE2i','admin');
INSERT IGNORE INTO Users(user_id,full_name,email,password_hash,role) VALUES
(39,'Dr. Vivek Kulkarni','vivek.kulkarni@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(40,'Dr. Nandini Deshmukh','nandini.deshmukh@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(41,'Dr. Sameer Kulkarni','sameer.kulkarni@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(42,'Dr. Isha Kapoor','isha.kapoor@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(43,'Dr. Harsh Vardhan','harsh.vardhan@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(44,'Dr. Tanvi Reddy','tanvi.reddy@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(45,'Dr. Mohit Sethi','mohit.sethi@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor'),
(46,'Dr. Aditi Bhatia','aditi.bhatia@dkhospital.com','$2b$10$eFjAjOlUXtqpkEtQ3Bvqbe4dzQch/9R.n2F8NW7Vwf/sCcXS8/TTW','doctor');
INSERT IGNORE INTO Doctors(user_id,specialization_id,license_no,years_experience,consultation_fee,avg_rating,daily_capacity)
SELECT u.user_id,s.specialization_id,CONCAT('LIC-',u.user_id),
6+(u.user_id MOD 12),700+(u.user_id MOD 5)*100,4.50+(u.user_id MOD 5)/10,12
FROM Users u JOIN Specializations s ON s.name=CASE u.user_id
WHEN 39 THEN 'Cardiology' WHEN 40 THEN 'Dermatology'
WHEN 41 THEN 'General Medicine' WHEN 42 THEN 'Orthopedics'
WHEN 43 THEN 'Pediatrics' WHEN 44 THEN 'Neurology'
WHEN 45 THEN 'Gastroenterology' WHEN 46 THEN 'Ophthalmology' END
WHERE u.user_id BETWEEN 39 AND 46;
INSERT IGNORE INTO Doctor_Availability(doctor_id,day_of_week,start_time,end_time,slot_duration_min)
SELECT d.doctor_id,days.day_of_week,'09:00:00','17:00:00',30
FROM Doctors d JOIN (SELECT 0 day_of_week UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) days ON 1=1
WHERE d.user_id BETWEEN 39 AND 46;
INSERT IGNORE INTO Patients(user_id,date_of_birth,phone,address) SELECT user_id,DATE_ADD('1980-01-01',INTERVAL (user_id-28)*700 DAY),CONCAT('555010',LPAD(user_id,4,'0')),CONCAT(user_id,' Northstar Avenue') FROM Users WHERE user_id BETWEEN 28 AND 37;
INSERT IGNORE INTO Appointments(patient_id,doctor_id,availability_id,appointment_date,start_time,end_time,status)
SELECT p.patient_id,d.doctor_id,a.availability_id,'2026-09-15','09:00:00','09:30:00','completed' FROM Patients p JOIN Users u ON u.user_id=p.user_id JOIN Doctors d ON d.user_id=1 JOIN Doctor_Availability a ON a.doctor_id=d.doctor_id AND a.day_of_week=2 WHERE u.user_id=28;
INSERT IGNORE INTO Appointments(patient_id,doctor_id,availability_id,appointment_date,start_time,end_time,status)
SELECT p.patient_id,d.doctor_id,a.availability_id,'2026-09-15','10:00:00','10:30:00','cancelled' FROM Patients p JOIN Users u ON u.user_id=p.user_id JOIN Doctors d ON d.user_id=2 JOIN Doctor_Availability a ON a.doctor_id=d.doctor_id AND a.day_of_week=2 WHERE u.user_id=29;
INSERT IGNORE INTO Appointments(patient_id,doctor_id,availability_id,appointment_date,start_time,end_time,status)
SELECT p.patient_id,d.doctor_id,a.availability_id,'2026-09-17','11:00:00','11:30:00','booked' FROM Patients p JOIN Users u ON u.user_id=p.user_id JOIN Doctors d ON d.user_id=1 JOIN Doctor_Availability a ON a.doctor_id=d.doctor_id AND a.day_of_week=4 WHERE u.user_id=30;
