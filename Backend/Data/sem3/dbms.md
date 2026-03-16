Database Management Systems (DBMS) Notes
1. Introduction to DBMS

A Database Management System (DBMS) is software that allows users to define, create, maintain, and control access to databases.

Key Objectives

Data storage and retrieval

Data consistency and integrity

Data security

Reduced redundancy

Concurrent access

Examples

MySQL

PostgreSQL

Oracle

MongoDB

2. File System vs DBMS
File System	DBMS
Data redundancy	Minimal redundancy
No data consistency	Ensures consistency
Poor security	Strong security
No concurrency control	Supports concurrency
Difficult data access	Easy querying using SQL
3. Database Architecture
3-Level Architecture

External Level – User views

Conceptual Level – Logical structure

Internal Level – Physical storage

Data Independence

Logical Data Independence: Change in schema doesn’t affect user view

Physical Data Independence: Change in storage doesn’t affect schema

4. Data Models
Types of Data Models

Hierarchical Model

Network Model

Relational Model

Object-Oriented Model

Object-Relational Model

Relational Model

Data stored in tables (relations)

Rows = tuples

Columns = attributes

Primary key uniquely identifies each row

5. Entity Relationship (ER) Model
Components

Entity: Real-world object

Attribute: Property of an entity

Relationship: Association between entities

Types of Attributes

Simple / Composite

Single-valued / Multi-valued

Derived

Cardinality

One-to-One (1:1)

One-to-Many (1:N)

Many-to-Many (M:N)

6. Relational Algebra

Procedural query language used internally by DBMS.

Operations

Selection (σ)

Projection (π)

Union (∪)

Intersection (∩)

Difference (−)

Cartesian Product (×)

Join

7. Structured Query Language (SQL)
SQL Categories

DDL: CREATE, ALTER, DROP

DML: INSERT, UPDATE, DELETE

DQL: SELECT

DCL: GRANT, REVOKE

TCL: COMMIT, ROLLBACK, SAVEPOINT

Example
SELECT name, marks
FROM students
WHERE marks > 80;

8. Constraints

Used to enforce rules on data.

Types

NOT NULL

UNIQUE

PRIMARY KEY

FOREIGN KEY

CHECK

DEFAULT

9. Normalization

Process of reducing data redundancy and improving data integrity.

Normal Forms

1NF: Atomic values

2NF: No partial dependency

3NF: No transitive dependency

BCNF: Stronger version of 3NF

Benefits

Removes redundancy

Avoids update anomalies

Improves consistency

10. Transactions

A transaction is a sequence of operations treated as a single logical unit.

ACID Properties

Atomicity: All or nothing

Consistency: Valid state before and after

Isolation: Concurrent transactions don’t interfere

Durability: Changes persist after commit

11. Concurrency Control
Problems

Lost update

Dirty read

Unrepeatable read

Techniques

Lock-based protocols

Timestamp ordering

Optimistic concurrency control

12. Deadlock
Conditions for Deadlock

Mutual exclusion

Hold and wait

No preemption

Circular wait

Handling Deadlock

Prevention

Avoidance

Detection and recovery

13. Indexing
Purpose

Speed up data retrieval

Types

Primary index

Secondary index

Clustered index

Non-clustered index

14. File Organization
Types

Heap file

Sequential file

Hash file

B+ Tree

15. Database Security
Security Measures

Authentication

Authorization

Encryption

Backup and recovery

SQL Security
GRANT SELECT ON students TO user1;
REVOKE SELECT ON students FROM user1;

16. Backup and Recovery
Failure Types

Transaction failure

System crash

Disk failure

Recovery Techniques

Log-based recovery

Checkpoints

Shadow paging

17. Distributed Databases
Characteristics

Data stored across multiple locations

Transparency

Reliability

Scalability

Types

Homogeneous

Heterogeneous

18. NoSQL Databases
Features

Schema-less

Horizontal scalability

High availability

Types

Key-Value Stores

Document Databases

Column-Family Stores

Graph Databases

19. DBMS vs RDBMS
DBMS	RDBMS
Single user	Multi-user
No normalization	Normalized tables
Limited security	Strong security
No relationships	Uses foreign keys
20. Advantages of DBMS

Data consistency

Data security

Easy data access

Reduced redundancy

Better decision making