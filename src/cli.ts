#!/usr/bin/env node

// Simple example CLI using commander for command handling with proper TypeScript typing

import { Command } from "commander";

const handleGreet = (name: string, options: { age?: string }): void => {
  console.log(`Hello, ${name}!`);
  if (options.age) {
    console.log(`You are ${options.age} years old.`);
  }
};

const handleUser = (options: { age?: string; name?: string }): void => {
  if (options.name || options.age) {
    console.log("Name:", options.name || "Not provided");
    console.log("Age:", options.age || "Not provided");
  } else {
    console.log("No options provided. Use --help for usage information.");
  }
};

const handleAdd = (a: string, b: string): void => {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);

  if (isNaN(numA) || isNaN(numB)) {
    console.error("Error: Both arguments must be valid numbers");
    process.exit(1);
  }

  const sum = numA + numB;
  console.log(`${a} + ${b} = ${sum}`);
};

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
  .name("my-cli")
  .description("A simple example CLI with commands")
  .version("1.0.0");

// Greet command
program
  .command("greet <name>")
  .description("Greet a person")
  .option("-a, --age <age>", "Person's age")
  .action((name: string, options): void => {
    handleGreet(name, options);
  });

// User command
program
  .command("user")
  .description("Manage user information")
  .option("-n, --name <name>", "Set the person's name")
  .option("-a, --age <age>", "Set the person's age")
  .action((options): void => {
    handleUser(options);
  });

// Add subcommand
program
  .command("add <a> <b>")
  .description("Add two numbers together")
  .action((a: string, b: string): void => {
    handleAdd(a, b);
  });

program.parse();
