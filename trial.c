#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define MAX_TASKS 100
#define MAX_NAME_LEN 50
#define AGING_FACTOR 0.5
#define MAX_FILENAME_LEN 256

typedef struct {
    char name[MAX_NAME_LEN];
    int priority;
    int burst_time;
    int deadline;
    int waiting_time;
    int turnaround_time;
    int completed;
} Task;

typedef struct {
    char from[MAX_NAME_LEN];
    char to[MAX_NAME_LEN];
} Dependency;

Task tasks[MAX_TASKS];
Dependency dependencies[MAX_TASKS];
int num_tasks = 0;
int num_dependencies = 0;

// Global variables for filenames
char input_filename[MAX_FILENAME_LEN] = "input.txt";
char output_filename[MAX_FILENAME_LEN] = "taskoutput.txt";
char summary_filename[MAX_FILENAME_LEN] = "task_summary.txt";

int find_task_index(const char *name) {
    for (int i = 0; i < num_tasks; i++) {
        if (strcmp(tasks[i].name, name) == 0) {
            return i;
        }
    }
    return -1;
}

int check_dependency(int task_index) {
    for (int i = 0; i < num_dependencies; i++) {
        if (strcmp(dependencies[i].to, tasks[task_index].name) == 0) {
            int from_index = find_task_index(dependencies[i].from);
            if (from_index != -1 && !tasks[from_index].completed) {
                return 1;
            }
        }
    }
    return 0;
}

void parse_input() {
    FILE *file;

    // Open input file
    file = fopen(input_filename, "r");
    if (file == NULL) {
        printf("❌ Error: Could not open %s\n", input_filename);
        exit(1);
    }
    printf("✅ %s opened successfully!\n", input_filename);

    // Read number of tasks
    fscanf(file, "%d", &num_tasks);
    printf("📌 Number of tasks: %d\n", num_tasks);

    // Read tasks
    for (int i = 0; i < num_tasks; i++) {
        fscanf(file, "%s %d %d %d",
               tasks[i].name,
               &tasks[i].priority,
               &tasks[i].burst_time,
               &tasks[i].deadline);
        tasks[i].completed = 0;
        tasks[i].waiting_time = 0;
        tasks[i].turnaround_time = 0;

        printf("📄 Task %d Read: %s %d %d %d\n", i + 1,
               tasks[i].name, tasks[i].priority,
               tasks[i].burst_time, tasks[i].deadline);
    }

    // Read number of dependencies
    fscanf(file, "%d", &num_dependencies);
    printf("🔗 Number of dependencies: %d\n", num_dependencies);

    // Read dependencies
    for (int i = 0; i < num_dependencies; i++) {
        fscanf(file, "%s %s", dependencies[i].from, dependencies[i].to);
        printf("🔁 Dependency Read: %s → %s\n", dependencies[i].from, dependencies[i].to);
    }

    fclose(file);
    printf("✅ Finished reading %s\n\n", input_filename);
}

void write_output() {
    FILE *output, *summary;

    // Write taskoutput.txt
    output = fopen(output_filename, "w");
    if (output == NULL) {
        printf("❌ Error: Could not open %s for writing\n", output_filename);
        return;
    }

    // Calculate averages
    double total_waiting_time = 0;
    double total_turnaround_time = 0;
    for (int i = 0; i < num_tasks; i++) {
        total_waiting_time += tasks[i].waiting_time;
        total_turnaround_time += tasks[i].turnaround_time;
    }
    double avg_waiting_time = total_waiting_time / num_tasks;
    double avg_turnaround_time = total_turnaround_time / num_tasks;

    // Write JSON-style output
    fprintf(output, "{\n");
    fprintf(output, "  \"averageWaitingTime\": %.2f,\n", avg_waiting_time);
    fprintf(output, "  \"averageTurnaroundTime\": %.2f,\n", avg_turnaround_time);
    fprintf(output, "  \"executionOrder\": [\n");
    for (int i = 0; i < num_tasks; i++) {
        fprintf(output, "    \"%s\"%s\n", tasks[i].name, i < num_tasks - 1 ? "," : "");
    }
    fprintf(output, "  ],\n");
    fprintf(output, "  \"taskDetails\": [\n");
    for (int i = 0; i < num_tasks; i++) {
        fprintf(output, "    {\"name\": \"%s\", \"priority\": %d, \"burst_time\": %d, \"waitingTime\": %d, \"turnaroundTime\": %d}%s\n",
                tasks[i].name, tasks[i].priority, tasks[i].burst_time,
                tasks[i].waiting_time, tasks[i].turnaround_time,
                i < num_tasks - 1 ? "," : "");
    }
    fprintf(output, "  ]\n}");
    fclose(output);
    printf("✅ %s written successfully!\n", output_filename);

    // Write task_summary.txt
    summary = fopen(summary_filename, "w");
    if (summary == NULL) {
        printf("❌ Error: Could not open %s for writing\n", summary_filename);
        return;
    }

    fprintf(summary, "📘 Scheduling Summary\n");
    fprintf(summary, "====================\n\n");
    fprintf(summary, "🕓 Average Waiting Time: %.2f minutes\n", avg_waiting_time);
    fprintf(summary, "⏳ Average Turnaround Time: %.2f minutes\n\n", avg_turnaround_time);
    fprintf(summary, "🚀 Execution Order:\n");
    for (int i = 0; i < num_tasks; i++) {
        fprintf(summary, "%d. %s\n", i + 1, tasks[i].name);
    }
    fprintf(summary, "\n📋 Task Details:\n");
    for (int i = 0; i < num_tasks; i++) {
        fprintf(summary, "%s:\n", tasks[i].name);
        fprintf(summary, "  Priority: %d\n", tasks[i].priority);
        fprintf(summary, "  Duration: %d minutes\n", tasks[i].burst_time);
        fprintf(summary, "  Waiting Time: %d minutes\n", tasks[i].waiting_time);
        fprintf(summary, "  Turnaround Time: %d minutes\n\n", tasks[i].turnaround_time);
    }
    fclose(summary);
    printf("✅ %s written successfully!\n\n", summary_filename);
}

void schedule_tasks() {
    int current_time = 0;
    int completed_tasks = 0;
    int execution_order[MAX_TASKS];
    int order_index = 0;

    while (completed_tasks < num_tasks) {
        int highest_priority = -1;
        int selected_task = -1;

        for (int i = 0; i < num_tasks; i++) {
            if (!tasks[i].completed && !check_dependency(i)) {
                float aged_priority = tasks[i].priority + (current_time * AGING_FACTOR);

                if (highest_priority < aged_priority) {
                    highest_priority = aged_priority;
                    selected_task = i;
                }
            }
        }

        if (selected_task == -1) {
            current_time++;
            continue;
        }

        tasks[selected_task].waiting_time = current_time;
        current_time += tasks[selected_task].burst_time;
        tasks[selected_task].turnaround_time = current_time;

        tasks[selected_task].completed = 1;
        execution_order[order_index++] = selected_task;
        completed_tasks++;

        printf("✅ Executed: %s | Waiting: %d | Turnaround: %d\n",
               tasks[selected_task].name,
               tasks[selected_task].waiting_time,
               tasks[selected_task].turnaround_time);
    }

    // Reorder tasks array to match execution
    Task ordered_tasks[MAX_TASKS];
for (int i = 0; i < num_tasks; i++) {
    ordered_tasks[i] = tasks[execution_order[i]];
}
memcpy(tasks, ordered_tasks, sizeof(Task) * num_tasks);  // Final overwrite

}

int main(int argc, char *argv[]) {
    // Set filenames from command line arguments
    if (argc > 1) {
        strncpy(input_filename, argv[1], MAX_FILENAME_LEN - 1);
        input_filename[MAX_FILENAME_LEN - 1] = '\0';
    }
    if (argc > 2) {
        strncpy(output_filename, argv[2], MAX_FILENAME_LEN - 1);
        output_filename[MAX_FILENAME_LEN - 1] = '\0';
    }
    if (argc > 3) {
        strncpy(summary_filename, argv[3], MAX_FILENAME_LEN - 1);
        summary_filename[MAX_FILENAME_LEN - 1] = '\0';
    }

    printf("Using files:\n");
    printf("Input: %s\n", input_filename);
    printf("Output: %s\n", output_filename);
    printf("Summary: %s\n", summary_filename);

    parse_input();
    schedule_tasks();
    write_output();
    return 0;
}

