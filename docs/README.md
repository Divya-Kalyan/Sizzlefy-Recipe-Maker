# Task Scheduler System

## Overview
The Task Scheduler System is a comprehensive solution for managing and scheduling tasks with priorities, dependencies, and deadlines. It consists of a C backend for core scheduling, a Java GUI for viewing results, and an HTML/CSS frontend for visual representation.

## Features
- **Priority-Based Scheduling:** Tasks are executed based on their priority.
- **Aging Mechanism:** Prevents starvation by increasing the priority of long-waiting tasks.
- **Dependency Management:** Handles task dependencies and detects circular dependencies.
- **File I/O:** Tasks and results are saved and loaded via files.
- **Java GUI:** Displays task execution results and summary statistics.
- **HTML/CSS Frontend:** Visual representation and design prototype (non-functional).

## Components
- **C Backend (`trial.c`):** Implements core scheduling algorithms and dependency management.
- **Java GUI (`TaskScheduler.java`):** Displays task execution results and summary statistics.
- **Output Files (`taskoutput.txt`, `summary.txt`):** Generated at runtime, containing detailed execution order and summary statistics.
- **HTML/CSS Frontend (`index.html`):** Visual representation and design prototype.

## Setup and Installation
1. **Compile the C Backend:**
   ```bash
   gcc trial.c -o scheduler.exe
   ```

2. **Compile the Java GUI:**
   ```bash
   javac TaskScheduler.java
   ```

3. **Run the Java GUI:**
   ```bash
   java TaskScheduler
   ```

## Usage
- Use the Java GUI to run the scheduler and view results.
- The C backend will generate `taskoutput.txt` and `summary.txt` with execution details and summary statistics.
- The HTML/CSS frontend is a static prototype for design purposes.

## Requirements
- C compiler (gcc)
- Java Runtime Environment (JRE)
- Web browser (for viewing the HTML/CSS frontend) 