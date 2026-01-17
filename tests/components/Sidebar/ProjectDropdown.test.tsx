import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectDropdown from '../../../components/Sidebar/ProjectDropdown';
import { mockNavigate, resetMocks } from '../../helpers/tanstack-router-mock.tsx';

describe('ProjectDropdown', () => {
  const mockProjects = [
    { id: 'proj_1', name: 'Project Alpha' },
    { id: 'proj_2', name: 'Project Beta' },
    { id: 'proj_3', name: 'A Very Long Project Name That Should Be Truncated' },
  ];

  const mockOnSelectProject = vi.fn();
  const mockOnCreateProject = vi.fn().mockResolvedValue('new_proj_id');
  const mockOnUpdateProject = vi.fn();

  const defaultProps = {
    projects: mockProjects,
    activeProjectId: 'proj_1',
    onSelectProject: mockOnSelectProject,
    onCreateProject: mockOnCreateProject,
    onUpdateProject: mockOnUpdateProject,
    isCollapsed: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('Expanded View', () => {
    it('should render with active project name', () => {
      render(<ProjectDropdown {...defaultProps} />);

      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    it('should show "Select a project..." when no project is selected', () => {
      render(<ProjectDropdown {...defaultProps} activeProjectId={null} />);

      expect(screen.getByText('Select a project...')).toBeInTheDocument();
    });

    it('should truncate long project names with ellipsis', () => {
      render(<ProjectDropdown {...defaultProps} activeProjectId="proj_3" />);

      // Name should be truncated to 20 chars + '...'
      expect(screen.getByText('A Very Long Project ...')).toBeInTheDocument();
    });

    it('should show full name in title attribute for truncated names', () => {
      render(<ProjectDropdown {...defaultProps} activeProjectId="proj_3" />);

      const nameElement = screen.getByText('A Very Long Project ...');
      expect(nameElement).toHaveAttribute('title', 'A Very Long Project Name That Should Be Truncated');
    });

    it('should open dropdown when clicked', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      // Click the dropdown trigger
      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.click(trigger!);

      // Should show all projects
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });

    it('should show checkmark for currently selected project', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.click(trigger!);

      await waitFor(() => {
        const selectedOption = screen.getByRole('option', { selected: true });
        expect(selectedOption).toHaveTextContent('Project Alpha');
      });
    });

    it('should call onSelectProject when a project is selected', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.click(trigger!);

      await waitFor(() => {
        expect(screen.getByText('Project Beta')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Project Beta'));

      expect(mockOnSelectProject).toHaveBeenCalledWith('proj_2');
    });

    it('should show "Create New Project" option at the bottom', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.click(trigger!);

      await waitFor(() => {
        expect(screen.getByText('Create New Project')).toBeInTheDocument();
      });
    });

    it('should call onCreateProject and navigate when creating a new project', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.click(trigger!);

      await waitFor(() => {
        expect(screen.getByText('Create New Project')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create New Project'));

      await waitFor(() => {
        expect(mockOnCreateProject).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith({
          to: '/project/$projectId/script',
          params: { projectId: 'new_proj_id' }
        });
      });
    });

    it('should show empty state when no projects exist', async () => {
      render(<ProjectDropdown {...defaultProps} projects={[]} activeProjectId={null} />);

      const trigger = screen.getByText('Select a project...').closest('div');
      fireEvent.click(trigger!);

      await waitFor(() => {
        expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
      });
    });
  });

  describe('Inline Rename', () => {
    it('should show edit icon on hover', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.mouseEnter(trigger!);

      await waitFor(() => {
        const editButton = screen.getByTitle('Rename Project');
        expect(editButton).toBeInTheDocument();
      });
    });

    it('should enter edit mode when edit icon is clicked', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      // Find and click the edit button
      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.mouseEnter(trigger!);

      const editButton = screen.getByTitle('Rename Project');
      fireEvent.click(editButton);

      await waitFor(() => {
        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('Project Alpha');
      });
    });

    it('should save new name on Enter key', async () => {
      const user = userEvent.setup();
      render(<ProjectDropdown {...defaultProps} />);

      // Enter edit mode
      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.mouseEnter(trigger!);
      const editButton = screen.getByTitle('Rename Project');
      fireEvent.click(editButton);

      // Type new name and press Enter
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'New Project Name{Enter}');

      expect(mockOnUpdateProject).toHaveBeenCalledWith('proj_1', { name: 'New Project Name' });
    });

    it('should cancel editing on Escape key', async () => {
      const user = userEvent.setup();
      render(<ProjectDropdown {...defaultProps} />);

      // Enter edit mode
      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.mouseEnter(trigger!);
      const editButton = screen.getByTitle('Rename Project');
      fireEvent.click(editButton);

      // Type new name and press Escape
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'New Name{Escape}');

      // Should NOT call update
      expect(mockOnUpdateProject).not.toHaveBeenCalled();

      // Should show original name
      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });
    });

    it('should save on blur', async () => {
      const user = userEvent.setup();
      render(<ProjectDropdown {...defaultProps} />);

      // Enter edit mode
      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.mouseEnter(trigger!);
      const editButton = screen.getByTitle('Rename Project');
      fireEvent.click(editButton);

      // Type new name and blur
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'Blurred Name');
      fireEvent.blur(input);

      expect(mockOnUpdateProject).toHaveBeenCalledWith('proj_1', { name: 'Blurred Name' });
    });

    it('should not save empty names', async () => {
      const user = userEvent.setup();
      render(<ProjectDropdown {...defaultProps} />);

      // Enter edit mode
      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.mouseEnter(trigger!);
      const editButton = screen.getByTitle('Rename Project');
      fireEvent.click(editButton);

      // Clear and try to save
      const input = screen.getByRole('textbox');
      await user.clear(input);
      fireEvent.blur(input);

      // Should NOT call update with empty name
      expect(mockOnUpdateProject).not.toHaveBeenCalled();
    });

    it('should not show edit icon when no project is selected', () => {
      render(<ProjectDropdown {...defaultProps} activeProjectId={null} />);

      const editButton = screen.queryByTitle('Rename Project');
      expect(editButton).not.toBeInTheDocument();
    });
  });

  describe('Collapsed View', () => {
    it('should render as icon only when collapsed', () => {
      render(<ProjectDropdown {...defaultProps} isCollapsed={true} />);

      // Should not show project name in collapsed view
      expect(screen.queryByText('Project Alpha')).not.toBeInTheDocument();

      // Should show the button with folder icon
      const button = screen.getByRole('button', { name: /Select active project/i });
      expect(button).toBeInTheDocument();
    });

    it('should show indicator dot when project is selected in collapsed view', () => {
      render(<ProjectDropdown {...defaultProps} isCollapsed={true} />);

      const button = screen.getByRole('button');
      const indicator = button.querySelector('.bg-primary.rounded-full');
      expect(indicator).toBeInTheDocument();
    });

    it('should not show indicator when no project selected in collapsed view', () => {
      render(<ProjectDropdown {...defaultProps} activeProjectId={null} isCollapsed={true} />);

      const button = screen.getByRole('button');
      const indicator = button.querySelector('.bg-primary.rounded-full');
      expect(indicator).not.toBeInTheDocument();
    });

    it('should open dropdown when clicked in collapsed view', async () => {
      render(<ProjectDropdown {...defaultProps} isCollapsed={true} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
        expect(screen.getByText('Project Beta')).toBeInTheDocument();
      });
    });

    it('should show full project name in title tooltip when collapsed', () => {
      render(<ProjectDropdown {...defaultProps} isCollapsed={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Project Alpha');
    });

    it('should show "Select a project" in title when no project selected', () => {
      render(<ProjectDropdown {...defaultProps} activeProjectId={null} isCollapsed={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Select a project');
    });
  });

  describe('Dropdown Behavior', () => {
    it('should close dropdown when clicking outside', async () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <ProjectDropdown {...defaultProps} />
        </div>
      );

      // Open dropdown
      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.click(trigger!);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('should close dropdown after selecting a project', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      // Open dropdown
      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.click(trigger!);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Select a project
      fireEvent.click(screen.getByText('Project Beta'));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('should rotate chevron icon when dropdown is open', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      // Open dropdown
      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.click(trigger!);

      await waitFor(() => {
        // Check that the chevron has rotate-180 class
        const chevron = trigger?.querySelector('[class*="rotate-180"]');
        expect(chevron).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have correct ARIA attributes on trigger', () => {
      render(<ProjectDropdown {...defaultProps} isCollapsed={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Select active project');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should set aria-expanded to true when open', async () => {
      render(<ProjectDropdown {...defaultProps} isCollapsed={true} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should have correct ARIA attributes on dropdown menu', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.click(trigger!);

      await waitFor(() => {
        const listbox = screen.getByRole('listbox');
        expect(listbox).toHaveAttribute('aria-label', 'Available projects');
      });
    });

    it('should mark selected option with aria-selected', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.click(trigger!);

      await waitFor(() => {
        const selectedOption = screen.getByRole('option', { selected: true });
        expect(selectedOption).toHaveTextContent('Project Alpha');
      });
    });

    it('should have aria-label on edit input', async () => {
      render(<ProjectDropdown {...defaultProps} />);

      const trigger = screen.getByText('Project Alpha').closest('div');
      fireEvent.mouseEnter(trigger!);
      const editButton = screen.getByTitle('Rename Project');
      fireEvent.click(editButton);

      await waitFor(() => {
        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('aria-label', 'Project name');
      });
    });
  });
});
