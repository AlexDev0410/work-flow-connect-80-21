import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthState, UserType } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { authService } from '@/services/api';

// Define actions
type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: UserType; token: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'REGISTER_START' }
  | { type: 'REGISTER_SUCCESS'; payload: { user: UserType; token: string } }
  | { type: 'REGISTER_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'VERIFY_TOKEN_START' }
  | { type: 'VERIFY_TOKEN_SUCCESS'; payload: { user: UserType } }
  | { type: 'VERIFY_TOKEN_FAILURE'; payload: string }
  | { type: 'UPDATE_PROFILE'; payload: { user: UserType } };

// Initial state
const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  loading: false,
  error: null,
  isAuthenticated: !!localStorage.getItem('token'),
};

// Reducer for updating state
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
    case 'REGISTER_START':
    case 'VERIFY_TOKEN_START':
      return {
        ...state,
        loading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
      localStorage.setItem('token', action.payload.token);
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        loading: false,
        error: null,
        isAuthenticated: true,
      };
    case 'VERIFY_TOKEN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        loading: false,
        error: null,
        isAuthenticated: true,
      };
    case 'UPDATE_PROFILE':
      return {
        ...state,
        user: action.payload.user,
        loading: false,
      };
    case 'LOGIN_FAILURE':
    case 'REGISTER_FAILURE':
    case 'VERIFY_TOKEN_FAILURE':
      return {
        ...state,
        loading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      localStorage.removeItem('token');
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
      };
    default:
      return state;
  }
};

// Create context
export interface AuthContextType {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
  currentUser: UserType | null;
  isAuthenticated: boolean;
  updateUserProfile: (userData: Partial<UserType>) => Promise<void>;
  uploadProfilePhoto: (file: File) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Determine base URL based on environment
const API_URL = 'http://localhost:5000/api';

// Context provider
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Verify if user is already authenticated when page loads
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        console.log("Verifying token:", token);
        dispatch({ type: 'VERIFY_TOKEN_START' });
        
        const response = await fetch(`${API_URL}/auth/verify`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Verification successful:", data);
          dispatch({
            type: 'VERIFY_TOKEN_SUCCESS',
            payload: { user: data.user }
          });
          
          // If verification is successful, check if we are on login/register pages
          // and redirect if needed
          const currentPath = window.location.pathname;
          if (currentPath === '/login' || currentPath === '/register' || currentPath === '/') {
            navigate('/dashboard');
          }
        } else {
          console.log("Invalid token");
          dispatch({
            type: 'VERIFY_TOKEN_FAILURE',
            payload: 'Token inválido o expirado'
          });
          // If token is not valid, clear storage
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Error verifying authentication:', error);
        dispatch({
          type: 'VERIFY_TOKEN_FAILURE',
          payload: 'Error verificando la autenticación'
        });
      }
    };

    checkAuthStatus();
  }, [navigate]);

  // Function to login
  const login = async (email: string, password: string) => {
    dispatch({ type: 'LOGIN_START' });

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user: data.user, token: data.token }
        });
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        
        // Redirect to dashboard after successful login
        navigate('/dashboard');
      } else {
        dispatch({
          type: 'LOGIN_FAILURE',
          payload: data.message || 'Error logging in'
        });
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || 'Error logging in',
        });
      }
    } catch (error) {
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: 'Error connecting to server'
      });
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not connect to server",
      });
    }
  };

  // Function to register
  const register = async (username: string, email: string, password: string, role: string = 'client') => {
    dispatch({ type: 'REGISTER_START' });

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, role })
      });

      const data = await response.json();

      if (response.ok) {
        dispatch({
          type: 'REGISTER_SUCCESS',
          payload: { user: data.user, token: data.token }
        });
        toast({
          title: "Registration successful!",
          description: "Your account has been created successfully.",
        });
        
        // Redirect to dashboard after successful registration
        navigate('/dashboard');
      } else {
        dispatch({
          type: 'REGISTER_FAILURE',
          payload: data.message || 'Error registering'
        });
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || 'Error registering',
        });
      }
    } catch (error) {
      dispatch({
        type: 'REGISTER_FAILURE',
        payload: 'Error connecting to server'
      });
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not connect to server",
      });
    }
  };

  // Function to logout
  const logout = () => {
    dispatch({ type: 'LOGOUT' });
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
    navigate('/login');
  };

  // Function to update user profile
  const updateUserProfile = async (userData: Partial<UserType>) => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !state.user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No has iniciado sesión",
        });
        return;
      }

      const response = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: userData.name,
          avatar: userData.photoURL,
          bio: userData.bio,
          skills: userData.skills
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          title: "Error",
          description: errorData.message || "Error al actualizar el perfil",
        });
        return;
      }

      const data = await response.json();
      
      // Update user in state
      const updatedUser = {
        ...state.user,
        name: data.name || state.user.name,
        photoURL: data.avatar || state.user.photoURL,
        bio: userData.bio || state.user.bio,
        skills: userData.skills || state.user.skills
      };

      dispatch({
        type: 'UPDATE_PROFILE',
        payload: { user: updatedUser }
      });

      toast({
        title: "Perfil actualizado",
        description: "Tu perfil ha sido actualizado correctamente",
      });

    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al actualizar el perfil",
      });
    }
  };

  // Function to upload profile photo
  const uploadProfilePhoto = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const token = localStorage.getItem('token');
        if (!token || !state.user) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "No has iniciado sesión",
          });
          reject("No has iniciado sesión");
          return;
        }

        // Create form data to upload file
        const formData = new FormData();
        formData.append('file', file);

        // For now, we'll simulate uploading and just return a data URL
        const reader = new FileReader();
        reader.onloadend = async function() {
          try {
            // In a real implementation, you would upload to server:
            // const response = await fetch(`${API_URL}/users/upload-avatar`, {
            //   method: 'POST',
            //   headers: { 'Authorization': `Bearer ${token}` },
            //   body: formData
            // });
            
            // For now, just update the profile with the base64 image
            const base64Image = reader.result as string;
            
            await updateUserProfile({
              photoURL: base64Image
            });
            
            resolve(base64Image);
          } catch (error) {
            reject(error);
          }
        };
        
        reader.onerror = () => reject("Error reading file");
        reader.readAsDataURL(file);
        
      } catch (error) {
        console.error('Error uploading profile photo:', error);
        reject(error);
      }
    });
  };

  // Export convenient values and functions
  const contextValue: AuthContextType = {
    state,
    login,
    register,
    logout,
    currentUser: state.user,
    isAuthenticated: state.isAuthenticated,
    updateUserProfile,
    uploadProfilePhoto
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
