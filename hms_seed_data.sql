-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: hms_db
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointments` (
  `Appt_ID` int NOT NULL AUTO_INCREMENT,
  `Patient_ID` int NOT NULL,
  `Doctor_ID` int NOT NULL,
  `Date` date NOT NULL,
  `Time` time NOT NULL,
  `Status` varchar(50) NOT NULL,
  PRIMARY KEY (`Appt_ID`),
  KEY `Patient_ID` (`Patient_ID`),
  KEY `Doctor_ID` (`Doctor_ID`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`Patient_ID`) REFERENCES `patients` (`Patient_ID`),
  CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`Doctor_ID`) REFERENCES `doctors` (`Doctor_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointments`
--

LOCK TABLES `appointments` WRITE;
/*!40000 ALTER TABLE `appointments` DISABLE KEYS */;
INSERT INTO `appointments` VALUES (1,101,201,'2024-10-10','10:00:00','Cancelled'),(2,102,202,'2024-10-11','14:30:00','Completed'),(3,101,201,'2024-09-01','10:00:00','Completed'),(4,103,201,'2025-10-11','06:27:00','Cancelled'),(5,103,201,'2025-10-11','06:27:00','Scheduled'),(6,103,201,'2025-10-11','08:29:00','Scheduled'),(7,103,201,'2025-10-11','08:29:00','Cancelled'),(8,101,201,'2025-10-12','05:32:00','Scheduled');
/*!40000 ALTER TABLE `appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bills`
--

DROP TABLE IF EXISTS `bills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bills` (
  `Bill_ID` int NOT NULL AUTO_INCREMENT,
  `Patient_ID` int NOT NULL,
  `Item` varchar(255) NOT NULL,
  `Amount` decimal(10,2) NOT NULL,
  `Payment_Status` varchar(50) NOT NULL,
  `Date_Issued` date NOT NULL,
  PRIMARY KEY (`Bill_ID`),
  KEY `Patient_ID` (`Patient_ID`),
  CONSTRAINT `bills_ibfk_1` FOREIGN KEY (`Patient_ID`) REFERENCES `patients` (`Patient_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bills`
--

LOCK TABLES `bills` WRITE;
/*!40000 ALTER TABLE `bills` DISABLE KEYS */;
INSERT INTO `bills` VALUES (1,101,'Cardiology Visit',250.00,'Pending','2024-10-01'),(2,102,'Neurology Visit',300.00,'Paid','2024-09-01'),(3,101,'Room Booking (R101)',5000.00,'Pending','2024-10-01'),(4,105,'Room Booking(R302)',5000.00,'Pending','2025-10-10');
/*!40000 ALTER TABLE `bills` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `Dept_ID` int NOT NULL,
  `Dept_Name` varchar(100) NOT NULL,
  PRIMARY KEY (`Dept_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (301,'Cardiology'),(302,'Neurology'),(303,'Pediatrics'),(304,'Orthopedics'),(305,'General');
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctors`
--

DROP TABLE IF EXISTS `doctors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctors` (
  `Doctor_ID` int NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Specialization` varchar(100) DEFAULT NULL,
  `Login_ID` varchar(50) NOT NULL,
  `Password` varchar(50) NOT NULL,
  `Dept_ID` int DEFAULT NULL,
  PRIMARY KEY (`Doctor_ID`),
  UNIQUE KEY `Login_ID` (`Login_ID`),
  KEY `Dept_ID` (`Dept_ID`),
  CONSTRAINT `doctors_ibfk_1` FOREIGN KEY (`Dept_ID`) REFERENCES `departments` (`Dept_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctors`
--

LOCK TABLES `doctors` WRITE;
/*!40000 ALTER TABLE `doctors` DISABLE KEYS */;
INSERT INTO `doctors` VALUES (201,'Charles Lee','Cardiologist','charles','charles@123',301),(202,'Diana Prince','Neurologist','diana','diana@123',302),(203,'Joshi','General','joshi','joshi@123',305),(204,'S.Varma','General','varma','varma@123',305),(205,'A.Sharma','Orthopedics','sharma','sharma@123',304);
/*!40000 ALTER TABLE `doctors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medical_record`
--

DROP TABLE IF EXISTS `medical_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medical_record` (
  `Record_ID` int NOT NULL AUTO_INCREMENT,
  `Patient_ID` int NOT NULL,
  `Diagnosis` text,
  `Allergies` varchar(255) DEFAULT NULL,
  `Surgeries` varchar(255) DEFAULT NULL,
  `Date` date DEFAULT NULL,
  PRIMARY KEY (`Record_ID`),
  UNIQUE KEY `Patient_ID` (`Patient_ID`),
  CONSTRAINT `fk_medical_record_patient` FOREIGN KEY (`Patient_ID`) REFERENCES `patients` (`Patient_ID`),
  CONSTRAINT `medical_record_ibfk_1` FOREIGN KEY (`Patient_ID`) REFERENCES `patients` (`Patient_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medical_record`
--

LOCK TABLES `medical_record` WRITE;
/*!40000 ALTER TABLE `medical_record` DISABLE KEYS */;
INSERT INTO `medical_record` VALUES (1,101,'Hypertension, Mild','Penicillin','Appendectomy (1995)','2024-05-01'),(2,102,'Chronic Migraine','None','Oral','2024-06-15'),(3,103,'Follow-up test - no med',NULL,NULL,'2025-10-12'),(4,104,'Fever','Dust','None','2025-01-01');
/*!40000 ALTER TABLE `medical_record` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicine`
--

DROP TABLE IF EXISTS `medicine`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicine` (
  `Medicine_ID` int NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Stock` int NOT NULL,
  PRIMARY KEY (`Medicine_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicine`
--

LOCK TABLES `medicine` WRITE;
/*!40000 ALTER TABLE `medicine` DISABLE KEYS */;
INSERT INTO `medicine` VALUES (601,'Aspirin',490),(602,'Paracetamol',780),(603,'Beta Blocker',150),(604,'Amoxicillin',600),(605,'Cetirizine',500),(606,'Mupirocin Ointment',200);
/*!40000 ALTER TABLE `medicine` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patients`
--

DROP TABLE IF EXISTS `patients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patients` (
  `Patient_ID` int NOT NULL,
  `Name` varchar(100) NOT NULL,
  `DOB` date NOT NULL,
  `Gender` varchar(10) DEFAULT NULL,
  `Address` varchar(255) DEFAULT NULL,
  `Primary_Doctor_ID` int DEFAULT NULL,
  PRIMARY KEY (`Patient_ID`),
  KEY `Primary_Doctor_ID` (`Primary_Doctor_ID`),
  CONSTRAINT `patients_ibfk_1` FOREIGN KEY (`Primary_Doctor_ID`) REFERENCES `doctors` (`Doctor_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patients`
--

LOCK TABLES `patients` WRITE;
/*!40000 ALTER TABLE `patients` DISABLE KEYS */;
INSERT INTO `patients` VALUES (101,'Alice Johnson','1985-04-12','F','123 Elm St, Anytown, CA',201),(102,'Bob Smith','1970-11-20','M','456 Oak Ave, Anytown, CA',202),(103,'raneesh','2003-12-30','M','manjeri,malappuram',203),(104,'adil','2000-10-10','M','kozhikode',204),(105,'Jane','1985-05-15','F','45 Maple St,City A',201);
/*!40000 ALTER TABLE `patients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prescription`
--

DROP TABLE IF EXISTS `prescription`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prescription` (
  `Prescription_ID` int NOT NULL AUTO_INCREMENT,
  `Doctor_ID` int NOT NULL,
  `Patient_ID` int NOT NULL,
  `Medicine_ID` int NOT NULL,
  `Quantity` int NOT NULL,
  `Date_Prescribed` date NOT NULL,
  PRIMARY KEY (`Prescription_ID`),
  KEY `Doctor_ID` (`Doctor_ID`),
  KEY `Patient_ID` (`Patient_ID`),
  KEY `Medicine_ID` (`Medicine_ID`),
  CONSTRAINT `prescription_ibfk_1` FOREIGN KEY (`Doctor_ID`) REFERENCES `doctors` (`Doctor_ID`),
  CONSTRAINT `prescription_ibfk_2` FOREIGN KEY (`Patient_ID`) REFERENCES `patients` (`Patient_ID`),
  CONSTRAINT `prescription_ibfk_3` FOREIGN KEY (`Medicine_ID`) REFERENCES `medicine` (`Medicine_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prescription`
--

LOCK TABLES `prescription` WRITE;
/*!40000 ALTER TABLE `prescription` DISABLE KEYS */;
INSERT INTO `prescription` VALUES (1,201,101,603,30,'2024-05-01'),(2,202,102,602,20,'2024-06-15'),(3,201,101,601,10,'2025-10-12'),(4,202,102,602,10,'2025-10-12'),(5,203,104,602,10,'2025-10-12');
/*!40000 ALTER TABLE `prescription` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rooms`
--

DROP TABLE IF EXISTS `rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rooms` (
  `Room_ID` varchar(10) NOT NULL,
  `Ward_ID` varchar(10) NOT NULL,
  `Type` varchar(50) DEFAULT NULL,
  `Availability` varchar(50) NOT NULL,
  `Patient_ID_Occupying` int DEFAULT NULL,
  PRIMARY KEY (`Room_ID`),
  KEY `Ward_ID` (`Ward_ID`),
  KEY `Patient_ID_Occupying` (`Patient_ID_Occupying`),
  CONSTRAINT `rooms_ibfk_1` FOREIGN KEY (`Ward_ID`) REFERENCES `wards` (`Ward_ID`),
  CONSTRAINT `rooms_ibfk_2` FOREIGN KEY (`Patient_ID_Occupying`) REFERENCES `patients` (`Patient_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rooms`
--

LOCK TABLES `rooms` WRITE;
/*!40000 ALTER TABLE `rooms` DISABLE KEYS */;
INSERT INTO `rooms` VALUES ('R101','W1','Standard','Available',NULL),('R102','W1','Standard','Unavailable',101),('R103','W1','AC','Available',NULL),('R201','W2','Private','Available',NULL),('R202','W2','Private','Unavailable',102),('R301','W3','AC','Available',NULL),('R302','W3','Standard','Unavailable',105);
/*!40000 ALTER TABLE `rooms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wards`
--

DROP TABLE IF EXISTS `wards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wards` (
  `Ward_ID` varchar(10) NOT NULL,
  `Ward_Name` varchar(100) NOT NULL,
  PRIMARY KEY (`Ward_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wards`
--

LOCK TABLES `wards` WRITE;
/*!40000 ALTER TABLE `wards` DISABLE KEYS */;
INSERT INTO `wards` VALUES ('W1','General Ward A'),('W2','Intensive Care'),('W3','Post-op Recovery');
/*!40000 ALTER TABLE `wards` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-04 19:06:52
