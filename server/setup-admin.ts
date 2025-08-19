// Setup script to create default admin user
import { storage } from "./storage";
import { hashPassword } from "./auth";

export async function createDefaultAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await storage.getUserByUsername('admin');
    if (existingAdmin) {
      console.log('Default admin user already exists');
      return;
    }

    // Create default admin user
    const hashedPassword = await hashPassword('password');
    const admin = await storage.createUser({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@stagelinq.com',
      role: 'admin'
    });

    console.log('Created default admin user:', {
      id: admin.id,
      username: admin.username,
      role: admin.role
    });
    console.log('Login with: username=admin, password=password');
    
  } catch (error) {
    console.error('Failed to create default admin user:', error);
  }
}