import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, LoginCredentials } from '../types';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
const socket = io(WS_URL);

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  error: string | null;
  users: User[];
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  getUsers: () => User[];
  fetchUsers: () => Promise<void>;
  addMember: (member: Omit<User, 'role'> & { role: 'member' }) => Promise<void>;
  updateMember: (id: string, updates: Partial<Omit<User, 'id' | 'role'>>) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  setUsers: (users: User[]) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // Set up Socket.IO listeners
      socket.on('dataUpdate', ({ type, data }) => {
        if (type === 'members') {
          set({ users: data });
        }
      });

      return {
        user: null,
        isAuthenticated: false,
        error: null,
        users: [],
        setUsers: (users) => set({ users }),

        fetchUsers: async () => {
          console.log('Fetching users...');
          try {
            const response = await fetch(`${API_URL}/members`, {
              credentials: 'include',
            });
            
            console.log('Fetch users response status:', response.status);
            if (!response.ok) {
              throw new Error('Failed to fetch users');
            }
            
            const users = await response.json();
            console.log(`Fetched ${users.length} users`);
            set({ users });
          } catch (error) {
            console.error('Failed to fetch users:', error);
            set({ error: 'Failed to fetch users' });
          }
        },

        login: async ({ email, password }) => {
          console.log('Attempting login for:', email);
          try {
            const response = await fetch(`${API_URL}/login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, password }),
              credentials: 'include',
            });

            console.log('Login response status:', response.status);
            const data = await response.json();

            if (!response.ok) {
              console.error('Login failed:', data.error);
              set({ error: data.error || 'Login failed' });
              return false;
            }

            console.log('Login successful');
            set({ user: data.user, isAuthenticated: true, error: null });
            return true;
          } catch (error) {
            console.error('Login error:', error);
            set({ error: 'Failed to connect to server' });
            return false;
          }
        },

        logout: () => {
          localStorage.removeItem('auth-storage');
          set({ user: null, isAuthenticated: false, error: null, users: [] });
          window.location.href = '/';
        },
        clearError: () => set({ error: null }),
        getUsers: () => get().users.map(({ password: _, ...user }) => user),

        addMember: async (member) => {
          try {
            const response = await fetch(`${API_URL}/members`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(member),
            });
            if (!response.ok) throw new Error('Failed to add member');
            await get().fetchUsers();
          } catch (error) {
            console.error('Failed to add member:', error);
            set({ error: 'Failed to add member' });
          }
        },

        updateMember: async (id, updates) => {
          try {
            const user = get().users.find(u => u.id === id);
            if (!user) throw new Error('User not found');
            
            const updatedMember = { ...user, ...updates };
            const response = await fetch(`${API_URL}/members/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatedMember),
            });
            if (!response.ok) throw new Error('Failed to update member');
            await get().fetchUsers();
          } catch (error) {
            console.error('Failed to update member:', error);
            set({ error: 'Failed to update member' });
          }
        },

        removeMember: async (id) => {
          try {
            console.log('Attempting to remove member:', id);
            const response = await fetch(`${API_URL}/members/${id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
            });
            
            console.log('Delete response status:', response.status);
            const data = await response.json().catch(() => null);
            console.log('Delete response data:', data);

            if (!response.ok) {
              throw new Error(data?.error || 'Failed to remove member');
            }
            
            // Only update the UI if the delete was successful
            set((state) => ({
              users: state.users.filter((user) => user.id !== id),
              error: null
            }));
          } catch (error) {
            console.error('Failed to remove member:', error);
            set({ error: error instanceof Error ? error.message : 'Failed to remove member' });
            throw error;
          }
        },
      };
    },
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);