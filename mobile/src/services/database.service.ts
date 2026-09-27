/**
 * Database Service - WatermelonDB initialization and utilities
 */

import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from '../database/schema';
import Project from '../database/models/Project';
import Inspection from '../database/models/Inspection';

let database: Database | null = null;

/**
 * Initialize the database
 */
export async function initializeDatabase(): Promise<Database> {
  if (database) {
    return database;
  }

  try {
    const adapter = new SQLiteAdapter({
      schema,
      dbName: 'hpms_mobile',
      migrations: [],
    });

    database = new Database({
      adapter,
      modelClasses: [Project, Inspection],
    });

    await database.write(async () => {
      // Initialize tables if needed
      console.log('Database initialized successfully');
    });

    return database;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Get database instance
 */
export function getDatabase(): Database {
  if (!database) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return database;
}

/**
 * Get all projects
 */
export async function getAllProjects() {
  try {
    const db = getDatabase();
    const projects = await db.get('projects').query().fetch();
    return projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

/**
 * Get project by ID
 */
export async function getProjectById(projectId: string) {
  try {
    const db = getDatabase();
    const project = await db.get('projects').find(projectId);
    return project;
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
}

/**
 * Get inspections for project
 */
export async function getProjectInspections(projectId: string) {
  try {
    const db = getDatabase();
    const inspections = await db
      .get('inspections')
      .query(['project_id', 'eq', projectId])
      .fetch();
    return inspections;
  } catch (error) {
    console.error('Error fetching inspections:', error);
    return [];
  }
}

/**
 * Create inspection
 */
export async function createInspection(data: any) {
  try {
    const db = getDatabase();
    const inspection = await db.write(async () => {
      return await db.get('inspections').create((record: any) => {
        record.projectId = data.projectId;
        record.inspectionDate = data.inspectionDate;
        record.notes = data.notes;
        record.photos = JSON.stringify(data.photos || []);
        record.signature = data.signature;
        record.inspectorId = data.inspectorId;
        record.syncStatus = 'pending';
      });
    });
    return inspection;
  } catch (error) {
    console.error('Error creating inspection:', error);
    throw error;
  }
}

/**
 * Clear all data
 */
export async function clearDatabase() {
  try {
    const db = getDatabase();
    await db.write(async () => {
      await db.unsafeResetDatabase();
    });
    console.log('Database cleared');
  } catch (error) {
    console.error('Error clearing database:', error);
  }
}

/**
 * Export database for backup
 */
export async function exportDatabase(): Promise<any> {
  try {
    const db = getDatabase();
    const projects = await getAllProjects();
    return {
      timestamp: Date.now(),
      version: 1,
      projects: projects.map(p => ({ ...p })),
    };
  } catch (error) {
    console.error('Error exporting database:', error);
    return null;
  }
}
