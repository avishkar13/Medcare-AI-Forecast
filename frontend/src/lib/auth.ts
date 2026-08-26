export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
    id: string;
    name: string;
    role: string;
  };
}

/**
 * Placeholder authentication function for MedCare Pharma.
 * Simulates a network delay and returns a mocked response.
 * This can be connected to the actual Express backend later.
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      // For now, accept any non-empty credentials
      if (!credentials.email || !credentials.password) {
        resolve({
          success: false,
          message: "Please enter both Email/Employee ID and Password.",
        });
        return;
      }

      // Mock failure for a specific test case
      if (credentials.password === "error") {
        resolve({
          success: false,
          message: "Invalid credentials. Please contact your organization administrator.",
        });
        return;
      }

      // Mock success
      resolve({
        success: true,
        token: "mock-jwt-token",
        user: {
          id: "USR-001",
          name: "Jane Doe",
          role: "Supply Chain Analyst",
        },
      });
    }, 1500); // 1.5 seconds delay to show loading state
  });
}
