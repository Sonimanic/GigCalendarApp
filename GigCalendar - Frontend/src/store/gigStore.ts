import { create } from 'zustand';
import { Gig, GigCommitment } from '../types';
import { loadGigs, loadCommitments, saveGigs, saveCommitments, deleteGig as apiDeleteGig, updateGig as apiUpdateGig } from '../utils/dataManager';
import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
console.log('WebSocket URL:', WS_URL);

const socket = io(WS_URL, {
  path: '/socket.io',
  transports: ['websocket'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  withCredentials: true,
  autoConnect: false
});

socket.on('connect', () => {
  console.log('Socket connected successfully');
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});

// Try to connect
socket.connect();

interface GigState {
  gigs: Gig[];
  commitments: GigCommitment[];
  loading: boolean;
  error: string | null;
  fetchGigs: () => Promise<void>;
  fetchCommitments: () => Promise<void>;
  addGig: (gig: Gig) => Promise<void>;
  updateGig: (gig: Gig) => Promise<void>;
  deleteGig: (id: string) => Promise<void>;
  updateCommitment: (commitment: GigCommitment) => Promise<void>;
  setGigs: (gigs: Gig[]) => void;
}

export const useGigStore = create<GigState>((set, get) => {
  // Set up Socket.IO listeners
  socket.on('dataUpdate', ({ type, data }) => {
    console.log('Received data update:', { type, data });
    if (type === 'gigs') {
      set({ gigs: data });
    }
  });

  return {
    gigs: [],
    commitments: [],
    loading: false,
    error: null,

    fetchGigs: async () => {
      console.log('Fetching gigs...');
      set({ loading: true });
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/gigs`);
        console.log('Gigs response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched gigs:', data);
        set({ gigs: data.gigs, loading: false, error: null });
      } catch (error) {
        console.error('Failed to load gigs:', error);
        set({ loading: false, error: 'Failed to load gigs' });
      }
    },

    fetchCommitments: async () => {
      console.log('Fetching commitments...');
      try {
        const commitments = await loadCommitments();
        console.log('Fetched commitments:', commitments);
        set({ commitments, error: null });
      } catch (error) {
        console.error('Failed to load commitments:', error);
        set({ error: 'Failed to fetch commitments' });
      }
    },

    addGig: async (gig) => {
      console.log('Adding gig:', gig);
      try {
        await saveGigs(gig);
        console.log('Gig saved successfully');
        set((state) => ({ 
          gigs: [...state.gigs, gig],
          error: null 
        }));
      } catch (error) {
        console.error('Failed to add gig:', error);
        set({ error: 'Failed to add gig' });
      }
    },

    updateGig: async (gig) => {
      console.log('Updating gig:', gig);
      try {
        await apiUpdateGig(gig);
        console.log('Gig updated successfully');
        set((state) => ({
          gigs: state.gigs.map((g) => (g.id === gig.id ? gig : g)),
          error: null
        }));
      } catch (error) {
        console.error('Failed to update gig:', error);
        set({ error: 'Failed to update gig' });
      }
    },

    deleteGig: async (id) => {
      console.log('Deleting gig:', id);
      try {
        await apiDeleteGig(id);
        console.log('Gig deleted successfully');
        set((state) => ({
          gigs: state.gigs.filter((g) => g.id !== id),
          commitments: state.commitments.filter((c) => c.gigId !== id),
          error: null
        }));
      } catch (error) {
        console.error('Failed to delete gig:', error);
        set({ error: 'Failed to delete gig' });
      }
    },

    updateCommitment: async (commitment) => {
      console.log('Updating commitment:', commitment);
      try {
        const updatedCommitments = [
          ...get().commitments.filter(
            (c) => c.gigId !== commitment.gigId || c.userId !== commitment.userId
          ),
          commitment,
        ];
        await saveCommitments(updatedCommitments);
        console.log('Commitment updated successfully');
        set((state) => ({
          commitments: updatedCommitments,
          error: null
        }));
      } catch (error) {
        console.error('Failed to update commitment:', error);
        set({ error: 'Failed to update commitment' });
      }
    },

    setGigs: (gigs) => set({ gigs }),
  };
});