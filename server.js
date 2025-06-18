const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const app = express();
const port = 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static files from the Priority_Scheduler directory
app.use(express.static(path.join(__dirname)));

// Define file paths relative to the Priority_Scheduler directory
const INPUT_FILE = path.join(__dirname, 'input.txt');
const OUTPUT_FILE = path.join(__dirname, 'taskoutput.txt');
const SUMMARY_FILE = path.join(__dirname, 'task_summary.txt');
const SCHEDULER_EXE = path.join(__dirname, 'trial.exe');
const JAVA_CLASS = path.join(__dirname, 'TaskScheduler.class');

// Ensure all paths are absolute
const absolutePaths = {
    input: INPUT_FILE,
    output: OUTPUT_FILE,
    summary: SUMMARY_FILE,
    exe: SCHEDULER_EXE
};

// Log all paths for debugging
console.log('File paths:');
console.log('Input:', absolutePaths.input);
console.log('Output:', absolutePaths.output);
console.log('Summary:', absolutePaths.summary);
console.log('Scheduler:', absolutePaths.exe);

// Promisify exec
const execPromise = util.promisify(exec);

console.log('Input File:', INPUT_FILE);
console.log('Output File:', OUTPUT_FILE);
console.log('Scheduler Exe:', SCHEDULER_EXE);

// Write tasks to input.txt
app.post('/api/write-input', (req, res) => {
    try {
        const { tasks } = req.body;
        console.log('Received tasks for input.txt:', tasks);

        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
            return res.status(400).json({ success: false, error: 'No tasks provided' });
        }

        // Validate each task
        for (const task of tasks) {
            if (!task.name || !task.priority || !task.duration) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Invalid task data: ${JSON.stringify(task)}` 
                });
            }
        }

        // Format the input content
        const inputContent = `${tasks.length}\n${tasks.map(task => 
            `${task.name} ${task.priority} ${task.duration} 0`
        ).join('\n')}`;

        console.log('Writing to input.txt:', inputContent);

        // Ensure the directory exists
        const inputDir = path.dirname(INPUT_FILE);
        if (!fs.existsSync(inputDir)) {
            fs.mkdirSync(inputDir, { recursive: true });
        }

        // Write to input.txt
        fs.writeFileSync(INPUT_FILE, inputContent);

        // Verify the content was written correctly
        const writtenContent = fs.readFileSync(INPUT_FILE, 'utf8');
        console.log('Content written to input.txt:', writtenContent);

        if (writtenContent !== inputContent) {
            throw new Error('Content verification failed - written content does not match expected content');
        }

        res.json({ 
            success: true, 
            message: 'Tasks written to input.txt successfully',
            taskCount: tasks.length
        });
    } catch (error) {
        console.error('Error writing to input.txt:', error);
        res.status(500).json({ 
            success: false, 
            error: `Failed to write to input.txt: ${error.message}` 
        });
    }
});

// Run C program
app.post('/api/run-c', async (req, res) => {
    try {
        console.log('\n=== Starting /api/run-c endpoint ===');
        
        // Check if scheduler exists
        if (!fs.existsSync(absolutePaths.exe)) {
            throw new Error(`Scheduler executable not found at ${absolutePaths.exe}`);
        }

        // Check if input file exists and has content
        if (!fs.existsSync(absolutePaths.input)) {
            throw new Error('Input file not found');
        }

        const inputContent = fs.readFileSync(absolutePaths.input, 'utf8');
        if (!inputContent.trim()) {
            throw new Error('Input file is empty');
        }

        // Clear previous output files if they exist
        if (fs.existsSync(absolutePaths.output)) {
            fs.unlinkSync(absolutePaths.output);
        }
        if (fs.existsSync(absolutePaths.summary)) {
            fs.unlinkSync(absolutePaths.summary);
        }

        // Run the scheduler program with absolute paths
        const command = `"${absolutePaths.exe}" "${absolutePaths.input}" "${absolutePaths.output}" "${absolutePaths.summary}"`;
        console.log('Executing command:', command);

        const { stdout, stderr } = await execPromise(command, { windowsHide: true });

        if (stderr) {
            throw new Error(`Scheduler error: ${stderr}`);
        }

        // Wait for files to be written
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify output files exist and have content
        if (!fs.existsSync(absolutePaths.output) || !fs.existsSync(absolutePaths.summary)) {
            throw new Error('Output files not found after running scheduler');
        }

        const outputContent = fs.readFileSync(absolutePaths.output, 'utf8');
        const summaryContent = fs.readFileSync(absolutePaths.summary, 'utf8');

        if (!outputContent.trim() || !summaryContent.trim()) {
            throw new Error('Output files are empty');
        }

        res.json({ 
            success: true, 
            message: 'Scheduler executed successfully',
            output: outputContent,
            summary: summaryContent
        });

    } catch (error) {
        console.error('Error in run-c endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Read output file
app.get('/api/read-output', (req, res) => {
    try {
        // Check if output file exists
        if (!fs.existsSync(OUTPUT_FILE)) {
            throw new Error('Output file not found');
        }

        const output = fs.readFileSync(OUTPUT_FILE, 'utf8');
        console.log('Reading output:', output);
        
        let schedule = [];
        let avg_waiting = 0;
        let avg_turnaround = 0;

        // Parse JSON output
        try {
            const data = JSON.parse(output);
            console.log('Parsed JSON output:', data);
            
            if (data.taskDetails) {
                schedule = data.taskDetails.map(task => ({
                    name: task.name,
                    priority: parseInt(task.priority) || 0,
                    duration: parseInt(task.burst_time) || 0,
                    waiting_time: parseInt(task.waitingTime) || 0,
                    turnaround_time: parseInt(task.turnaroundTime) || 0
                }));
                avg_waiting = parseFloat(data.averageWaitingTime) || 0;
                avg_turnaround = parseFloat(data.averageTurnaroundTime) || 0;
            }
        } catch (jsonError) {
            console.error('Error parsing JSON:', jsonError);
            throw new Error('Invalid JSON format in output file');
        }

        // Sort tasks by waiting time
        schedule.sort((a, b) => a.waiting_time - b.waiting_time);

        console.log('Final parsed schedule:', schedule);
        console.log('Average waiting time:', avg_waiting);
        console.log('Average turnaround time:', avg_turnaround);

        if (schedule.length === 0) {
            throw new Error('No tasks found in output');
        }

        res.json({ 
            success: true, 
            schedule,
            avg_waiting,
            avg_turnaround
        });
    } catch (error) {
        console.error('Error reading output:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to save tasks
app.post('/api/save', (req, res) => {
    const { tasks } = req.body;
    try {
        fs.writeFileSync(path.join(__dirname, '..', '..', 'tasks.json'), JSON.stringify(tasks, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to load tasks
app.get('/api/load', (req, res) => {
    try {
        const tasks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'tasks.json'), 'utf8'));
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to run Java GUI
app.post('/api/run-gui', (req, res) => {
    // First ensure input.txt is up to date
    try {
        const tasks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'tasks.json'), 'utf8'));
        const inputContent = `${tasks.length}\n` + tasks.map(task => 
            `${task.name} ${task.priority} ${task.duration} ${task.deadline || 0}`
        ).join('\n') + '\n0\n';
        
        fs.writeFileSync(INPUT_FILE, inputContent);
        
        // Run the Java GUI
        const javaCommand = `cd "${path.join(__dirname, '..', '..')}" && java -cp src/java TaskScheduler`;
        exec(javaCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing Java GUI: ${error}`);
                return res.status(500).json({ success: false, error: error.message });
            }
            res.json({ success: true });
        });
    } catch (error) {
        console.error('Error preparing for Java GUI:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Read Gantt chart data
app.get('/api/gantt-data', (req, res) => {
    try {
        const output = fs.readFileSync(OUTPUT_FILE, 'utf8');
        console.log('Reading Gantt data:', output);
        
        // Parse the JSON output
        const data = JSON.parse(output);
        
        // Transform the data into Gantt chart format
        const ganttData = Object.entries(data.taskDetails || {}).map(([name, task]) => ({
            name,
            start_time: parseInt(task.waitingTime) || 0,
            end_time: parseInt(task.turnaroundTime) || 0,
            duration: parseInt(task.burst_time) || 0,
            priority: parseInt(task.priority) || 0
        }));

        // Sort tasks by start time to ensure proper order
        ganttData.sort((a, b) => a.start_time - b.start_time);

        res.json({ 
            success: true, 
            ganttData,
            avg_waiting: parseFloat(data.averageWaitingTime) || 0,
            avg_turnaround: parseFloat(data.averageTurnaroundTime) || 0
        });
    } catch (error) {
        console.error('Error reading Gantt data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Handle task input
app.post('/tasks', async (req, res) => {
    console.log('\n=== Starting /tasks endpoint ===');
    const tasks = req.body;
    
    try {
        console.log('Received tasks:', JSON.stringify(tasks, null, 2));
        
        if (!Array.isArray(tasks) || tasks.length === 0) {
            throw new Error('No tasks provided');
        }

        // Validate each task
        tasks.forEach((task, index) => {
            if (!task.name || !task.priority || !task.burst) {
                throw new Error(`Invalid task at index ${index}: ${JSON.stringify(task)}`);
            }
        });

        // Format the content for input.txt
        const content = `${tasks.length}\n` + 
            tasks.map(task => 
                `${task.name} ${task.priority} ${task.burst} ${task.arrival || 0}`
            ).join('\n') + '\n0';
        
        console.log('Writing to input.txt:', content);
        
        // Ensure the directory exists
        const inputDir = path.dirname(INPUT_FILE);
        if (!fs.existsSync(inputDir)) {
            fs.mkdirSync(inputDir, { recursive: true });
        }
        
        // Write to input.txt
        fs.writeFileSync(INPUT_FILE, content);
        
        // Verify the content was written
        const writtenContent = fs.readFileSync(INPUT_FILE, 'utf8');
        console.log('Content written to input.txt:', writtenContent);
        
        if (writtenContent !== content) {
            throw new Error('Content verification failed - written content does not match expected content');
        }

        console.log('✅ Tasks written successfully');
        res.json({ 
            success: true,
            message: 'Tasks written successfully',
            taskCount: tasks.length
        });
    } catch (err) {
        console.error('❌ Error saving tasks:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save tasks: ' + err.message 
        });
    }
});

// Handle generate button click
app.post('/generate', async (req, res) => {
    console.log('\n=== Starting /generate endpoint ===');
    try {
        // Check if input.txt exists and has content
        if (!fs.existsSync(INPUT_FILE)) {
            throw new Error('Input file not found');
        }

        const inputContent = fs.readFileSync(INPUT_FILE, 'utf8');
        console.log('Input file content:', inputContent);
        
        if (!inputContent.trim()) {
            throw new Error('Input file is empty');
        }

        // Run the scheduler with absolute paths
        console.log('Running scheduler...');
        const command = `"${absolutePaths.exe}" "${absolutePaths.input}" "${absolutePaths.output}" "${absolutePaths.summary}"`;
        console.log('Executing command:', command);
        
        const { stdout, stderr } = await execPromise(command);
        
        if (stderr) {
            console.error(`Scheduler stderr: ${stderr}`);
            throw new Error('Scheduler execution failed');
        }

        console.log('Scheduler stdout:', stdout);

        // Wait for output files to be created
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Read the output files
        if (!fs.existsSync(OUTPUT_FILE)) {
            throw new Error('Output file not found after running scheduler');
        }

        const outputContent = fs.readFileSync(OUTPUT_FILE, 'utf8');
        console.log('Output file content:', outputContent);

        if (!fs.existsSync(SUMMARY_FILE)) {
            throw new Error('Summary file not found after running scheduler');
        }

        const summaryContent = fs.readFileSync(SUMMARY_FILE, 'utf8');
        console.log('Summary file content:', summaryContent);

        // Parse the output content
        let taskDetails = {};
        try {
            const data = JSON.parse(outputContent);
            if (data.taskDetails) {
                taskDetails = data.taskDetails.reduce((acc, task) => {
                    acc[task.name] = {
                        priority: task.priority,
                        burst_time: task.burst_time,
                        waitingTime: task.waitingTime,
                        turnaroundTime: task.turnaroundTime
                    };
                    return acc;
                }, {});
            }
        } catch (error) {
            console.error('Error parsing output JSON:', error);
            throw new Error('Failed to parse scheduler output');
        }

        console.log('✅ Schedule generated successfully');
        res.json({
            success: true,
            output: outputContent,
            summary: summaryContent,
            taskDetails: taskDetails
        });

    } catch (error) {
        console.error('❌ Error in generate endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 