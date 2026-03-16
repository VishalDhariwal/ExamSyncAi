C++ Programming Language Notes
1. Introduction to C++

C++ is a general-purpose, object-oriented programming language developed by Bjarne Stroustrup as an extension of C.

Features

Object-Oriented

Platform independent

High performance

Supports procedural and generic programming

Rich standard library (STL)

Applications

System software

Game development

Competitive programming

Embedded systems

High-performance applications

2. Basic Structure of a C++ Program
#include <iostream>
using namespace std;

int main() {
    cout << "Hello World";
    return 0;
}

Components

#include – Preprocessor directive

main() – Entry point

cout – Output stream

return 0 – Program termination

3. Data Types
Built-in Data Types

int

float

double

char

bool

void

Derived Data Types

Array

Pointer

Reference

Function

User-Defined Data Types

struct

union

enum

class

typedef

4. Variables and Constants
Variable Declaration
int x = 10;

Constants

const keyword

#define macro

const int MAX = 100;

5. Operators
Types of Operators

Arithmetic: + - * / %

Relational: < > <= >= == !=

Logical: && || !

Assignment: = += -=

Increment/Decrement: ++ --

Bitwise: & | ^ << >>

6. Control Statements
Conditional Statements

if

if-else

switch

Looping Statements

for

while

do-while

Jump Statements

break

continue

goto

return

7. Functions
Function Definition
int add(int a, int b) {
    return a + b;
}

Types of Functions

Built-in functions

User-defined functions

Function Overloading

Multiple functions with same name but different parameters.

8. Arrays and Strings
Array
int arr[5] = {1,2,3,4,5};

String

C-style strings (char[])

C++ strings (string class)

string name = "C++";

9. Pointers and References
Pointer
int x = 10;
int* p = &x;

Reference
int &ref = x;

Differences
Pointer	Reference
Can be null	Cannot be null
Can change address	Fixed once assigned
10. Object-Oriented Programming (OOP)
OOP Concepts

Class

Object

Encapsulation

Inheritance

Polymorphism

Abstraction

11. Classes and Objects
Class Example
class Student {
public:
    int roll;
    string name;

    void display() {
        cout << roll << " " << name;
    }
};

Object Creation
Student s1;

12. Constructors and Destructors
Constructor

Same name as class

Automatically called

Student() {
    roll = 0;
}

Destructor
~Student() {
}

13. Inheritance
Types of Inheritance

Single

Multiple

Multilevel

Hierarchical

Hybrid

class B : public A {
};
14. Polymorphism
Compile-Time Polymorphism

Function overloading

Operator overloading

Run-Time Polymorphism

Function overriding

Virtual functions

virtual void show();

15. Abstraction and Encapsulation
Encapsulation

Data hiding using private members

Abstraction

Using abstract classes and interfaces

class Shape {
public:
    virtual void draw() = 0;
};

16. Templates
Function Template
template <typename T>
T add(T a, T b) {
    return a + b;
}

Class Template
template <class T>
class Box {
    T value;
};

17. Standard Template Library (STL)
STL Components

Containers

Iterators

Algorithms

Common Containers

vector

list

deque

stack

queue

map

set

18. Exception Handling
Keywords

try

catch

throw

try {
    throw 10;
} catch(int e) {
    cout << e;
}

19. File Handling
File Streams

ifstream

ofstream

fstream

ofstream file("data.txt");
file << "Hello";
file.close();

20. Namespaces
Purpose

Avoid name conflicts

namespace demo {
    int x = 10;
}

21. Memory Management
Dynamic Memory Allocation

new

delete

int* p = new int;
delete p;

22. C vs C++
C	C++
Procedural	Object-Oriented
No classes	Supports classes
No function overloading	Supports overloading
No STL	Has STL
23. Advantages of C++

Fast execution

OOP support

Reusability

Large community

Suitable for system-level programming