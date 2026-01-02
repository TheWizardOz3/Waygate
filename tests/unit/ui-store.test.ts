import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/stores/ui.store';

describe('UI Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      sidebarOpen: true,
      activeModal: null,
    });
  });

  describe('sidebar', () => {
    it('initializes with sidebar open', () => {
      const { sidebarOpen } = useUIStore.getState();
      expect(sidebarOpen).toBe(true);
    });

    it('toggles sidebar', () => {
      const { toggleSidebar } = useUIStore.getState();

      toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);

      toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it('sets sidebar open state directly', () => {
      const { setSidebarOpen } = useUIStore.getState();

      setSidebarOpen(false);
      expect(useUIStore.getState().sidebarOpen).toBe(false);

      setSidebarOpen(true);
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe('modal', () => {
    it('initializes with no active modal', () => {
      const { activeModal } = useUIStore.getState();
      expect(activeModal).toBeNull();
    });

    it('opens modal with id', () => {
      const { openModal } = useUIStore.getState();

      openModal('create-integration');
      expect(useUIStore.getState().activeModal).toBe('create-integration');
    });

    it('closes modal', () => {
      const { openModal, closeModal } = useUIStore.getState();

      openModal('create-integration');
      closeModal();
      expect(useUIStore.getState().activeModal).toBeNull();
    });
  });
});
