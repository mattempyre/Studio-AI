import { vi } from 'vitest';

// Mock implementation for @tanstack/react-router
export const mockNavigate = vi.fn();
export const mockLocation = { pathname: '/', search: '', hash: '' };

export const useNavigate = () => mockNavigate;
export const useLocation = () => mockLocation;
export const useParams = () => ({});
export const Link = ({ children, to, ...props }: any) => (
  <a href={typeof to === 'string' ? to : '#'} {...props}>{children}</a>
);
export const Outlet = () => null;

// Router components
export const RouterProvider = ({ children }: any) => children;

// Mock route that supports addChildren
const createMockRoute = (opts: any) => ({
  ...opts,
  addChildren: (children: any[]) => ({
    ...opts,
    children,
    addChildren: (moreChildren: any[]) => ({
      ...opts,
      children: [...(children || []), ...moreChildren],
    }),
  }),
});

export const createRootRoute = (opts: any) => createMockRoute(opts);
export const createRoute = (opts: any) => createMockRoute(opts);
export const createRouter = (opts: any) => opts;
export const createMemoryHistory = () => ({
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  location: mockLocation,
});

// Reset function for tests
export const resetMocks = () => {
  mockNavigate.mockReset();
  mockLocation.pathname = '/';
  mockLocation.search = '';
  mockLocation.hash = '';
};
