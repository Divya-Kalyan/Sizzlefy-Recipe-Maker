import java.awt.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.List;
import javax.swing.*;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.DefaultTableModel;
import javax.swing.table.JTableHeader;
import javax.swing.table.TableCellRenderer;

// ... existing code ...

    private void runScheduler() {
        try {
            // Get the project root directory
            String projectRoot = new File(".").getAbsolutePath();
            System.out.println("Project Root: " + projectRoot); // Debug print

            // Update paths to match your project structure
            String inputPath = "Priority_Scheduler/input.txt";
            String outputPath = "Priority_Scheduler/taskoutput.txt";
            String summaryPath = "Priority_Scheduler/task_summary.txt";
            String schedulerPath = "Priority_Scheduler/trial.exe";

            System.out.println("Scheduler Path: " + schedulerPath); // Debug print
            System.out.println("Output Path: " + outputPath); // Debug print
            System.out.println("Summary Path: " + summaryPath); // Debug print

            // Step 1: Write input.txt from table data
            writeInputFile();

            // Step 2: Run the C executable
            ProcessBuilder pb = new ProcessBuilder(schedulerPath);
            pb.directory(new File(projectRoot));
            
            // Add error logging
            pb.redirectErrorStream(true);
            Process process = pb.start();

            // Read process output for debugging
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                System.out.println("Process output: " + line);
            }

            // Wait for the process to complete
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                JOptionPane.showMessageDialog(this, 
                    "❌ Scheduler execution failed with exit code: " + exitCode + 
                    "\nOutput: " + output.toString(),
                    "Error",
                    JOptionPane.ERROR_MESSAGE);
                return;
            }

            // Wait for output files to be created
            File outputFile = new File(outputPath);
            File summaryFile = new File(summaryPath);
            while (!outputFile.exists() || !summaryFile.exists()) {
                Thread.sleep(200);
            }

            // Step 3: Read the output files
            try {
                // Read taskoutput.txt
                String outputContent = new String(Files.readAllBytes(Paths.get(outputPath)));
                System.out.println("Output content: " + outputContent); // Debug print
                
                // Parse the output content
                Map<String, Map<String, String>> taskDetails = new HashMap<>();
                String currentTask = null;
                Map<String, String> currentTaskData = new HashMap<>();
                
                for (String outputLine : outputContent.split("\n")) {
                    outputLine = outputLine.trim();
                    if (outputLine.contains("\"taskDetails\"")) {
                        if (currentTask != null) {
                            taskDetails.put(currentTask, currentTaskData);
                            currentTaskData = new HashMap<>();
                        }
                        currentTask = outputLine.split(":")[1].replaceAll("[,\"]", "").trim();
                    } else if (outputLine.contains("\"priority\"")) {
                        currentTaskData.put("priority", outputLine.split(":")[1].replaceAll("[,\"]", "").trim());
                    } else if (outputLine.contains("\"burst_time\"")) {
                        currentTaskData.put("burst_time", outputLine.split(":")[1].replaceAll("[,\"]", "").trim());
                    } else if (outputLine.contains("\"waitingTime\"")) {
                        currentTaskData.put("waitingTime", outputLine.split(":")[1].replaceAll("[,\"]", "").trim());
                    } else if (outputLine.contains("\"turnaroundTime\"")) {
                        currentTaskData.put("turnaroundTime", outputLine.split(":")[1].replaceAll("[,\"]", "").trim());
                    }
                }
                if (currentTask != null) {
                    taskDetails.put(currentTask, currentTaskData);
                }
                
                // Read task_summary.txt
                String summaryContent = new String(Files.readAllBytes(Paths.get(summaryPath)));
                System.out.println("Summary content: " + summaryContent); // Debug print
                
                // Display results
                displayResults(taskDetails, summaryContent);
            } catch (IOException ex) {
                JOptionPane.showMessageDialog(this, 
                    "❌ Failed to read output files: " + ex.getMessage() + 
                    "\nOutput Path: " + outputPath + 
                    "\nSummary Path: " + summaryPath,
                    "Error",
                    JOptionPane.ERROR_MESSAGE);
            }
        } catch (Exception ex) {
            JOptionPane.showMessageDialog(this, 
                "❌ Error: " + ex.getMessage() + 
                "\nStack trace: " + Arrays.toString(ex.getStackTrace()),
                "Error",
                JOptionPane.ERROR_MESSAGE);
        }
    }

    private void writeInputFile() {
        try (PrintWriter pw = new PrintWriter(new FileWriter("Priority_Scheduler/input.txt"))) {
            int rowCount = tableModel.getRowCount();
            pw.println(rowCount);
            
            for (int i = 0; i < rowCount; i++) {
                String name = tableModel.getValueAt(i, 0).toString();
                String priority = tableModel.getValueAt(i, 1).toString();
                String duration = tableModel.getValueAt(i, 2).toString();
                String deadline = tableModel.getValueAt(i, 3).toString();
                
                pw.printf("%s %s %s %s%n", name, priority, duration, deadline);
            }
            
            pw.println("0"); // No dependencies
        } catch (IOException ex) {
            JOptionPane.showMessageDialog(this, 
                "Error writing to input.txt: " + ex.getMessage(), 
                "File Error", 
                JOptionPane.ERROR_MESSAGE);
        }
    }

    private void showResultsPopup() {
        // Create a dialog
        JDialog dialog = new JDialog(this, "Task Scheduler Results", true);
        dialog.setSize(800, 600);
        dialog.setLocationRelativeTo(this);
        dialog.setLayout(new BorderLayout());

        // Create main panel with padding
        JPanel mainPanel = new JPanel(new BorderLayout(10, 10));
        mainPanel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        // Create table model with columns
        DefaultTableModel popupTableModel = new DefaultTableModel();
        popupTableModel.setColumnIdentifiers(new String[]{
            "Task Name", "Priority", "Duration", "Waiting Time", "Turnaround Time"
        });

        // Read and parse task_summary.txt from Priority_Scheduler directory
        try (BufferedReader br = new BufferedReader(new FileReader("Priority_Scheduler/task_summary.txt"))) {
            String line;
            String currentTask = null;
            String priority = "";
            String duration = "";
            String waitingTime = "";
            String turnaroundTime = "";

            while ((line = br.readLine()) != null) {
                line = line.trim();
                
                if (line.startsWith("Task:")) {
                    // If we have a previous task, add it to the table
                    if (currentTask != null) {
                        popupTableModel.addRow(new Object[]{
                            currentTask, priority, duration, waitingTime, turnaroundTime
                        });
                    }
                    // Start new task
                    currentTask = line.substring(5).trim();
                } else if (line.startsWith("Priority:")) {
                    priority = line.substring(9).trim();
                } else if (line.startsWith("Duration:")) {
                    duration = line.substring(9).trim();
                } else if (line.startsWith("Waiting Time:")) {
                    waitingTime = line.substring(13).trim();
                } else if (line.startsWith("Turnaround Time:")) {
                    turnaroundTime = line.substring(16).trim();
                }
            }
            
            // Add the last task
            if (currentTask != null) {
                popupTableModel.addRow(new Object[]{
                    currentTask, priority, duration, waitingTime, turnaroundTime
                });
            }
        } catch (IOException ex) {
            JOptionPane.showMessageDialog(this, 
                "Could not read task_summary.txt: " + ex.getMessage(), 
                "File Error", 
                JOptionPane.ERROR_MESSAGE);
        }

        // Create table with custom renderer
        JTable popupTable = new JTable(popupTableModel) {
            @Override
            public Component prepareRenderer(TableCellRenderer renderer, int row, int column) {
                Component comp = super.prepareRenderer(renderer, row, column);
                if (!isRowSelected(row)) {
                    comp.setBackground(row % 2 == 0 ? Color.WHITE : new Color(240, 240, 240));
                }
                return comp;
            }
        };

        // Set column widths
        popupTable.getColumnModel().getColumn(0).setPreferredWidth(100);
        popupTable.getColumnModel().getColumn(1).setPreferredWidth(80);
        popupTable.getColumnModel().getColumn(2).setPreferredWidth(100);
        popupTable.getColumnModel().getColumn(3).setPreferredWidth(100);
        popupTable.getColumnModel().getColumn(4).setPreferredWidth(120);

        // Center align all columns
        DefaultTableCellRenderer centerRenderer = new DefaultTableCellRenderer();
        centerRenderer.setHorizontalAlignment(JLabel.CENTER);
        for (int i = 0; i < popupTable.getColumnCount(); i++) {
            popupTable.getColumnModel().getColumn(i).setCellRenderer(centerRenderer);
        }

        // Add table header
        JTableHeader header = popupTable.getTableHeader();
        header.setBackground(new Color(70, 130, 180));
        header.setForeground(Color.WHITE);
        header.setFont(header.getFont().deriveFont(Font.BOLD));

        // Create scroll pane for table
        JScrollPane tableScroll = new JScrollPane(popupTable);
        tableScroll.setBorder(BorderFactory.createEmptyBorder(0, 0, 10, 0));

        // Create summary panel
        JPanel summaryPanel = new JPanel(new GridLayout(2, 2, 10, 5));
        summaryPanel.setBorder(BorderFactory.createTitledBorder("Summary"));

        // Read averages from task_summary.txt in Priority_Scheduler directory
        try (BufferedReader br = new BufferedReader(new FileReader("Priority_Scheduler/task_summary.txt"))) {
            String line;
            while ((line = br.readLine()) != null) {
                if (line.startsWith("Average Waiting Time:")) {
                    summaryPanel.add(new JLabel("Average Waiting Time:"));
                    summaryPanel.add(new JLabel(line.substring(20).trim()));
                } else if (line.startsWith("Average Turnaround Time:")) {
                    summaryPanel.add(new JLabel("Average Turnaround Time:"));
                    summaryPanel.add(new JLabel(line.substring(23).trim()));
                }
            }
        } catch (IOException ex) {
            summaryPanel.add(new JLabel("Error reading summary"));
        }

        // Add components to main panel
        mainPanel.add(tableScroll, BorderLayout.CENTER);
        mainPanel.add(summaryPanel, BorderLayout.SOUTH);

        // Add close button
        JButton closeButton = new JButton("Close");
        closeButton.addActionListener(e -> dialog.dispose());
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.CENTER));
        buttonPanel.add(closeButton);
        mainPanel.add(buttonPanel, BorderLayout.SOUTH);

        // Add main panel to dialog
        dialog.add(mainPanel);

        dialog.setVisible(true);
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            new TaskScheduler().setVisible(true);
        });
    }
} 