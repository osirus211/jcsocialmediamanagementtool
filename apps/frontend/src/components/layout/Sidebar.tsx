import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';

export const Sidebar = () => {
  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="h-full flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            SMS
          </h2>
        </div>

        {/* Workspace Switcher */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <WorkspaceSwitcher />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <a
                href="/"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>🏠</span>
                <span>Dashboard</span>
              </a>
            </li>
            <li>
              <a
                href="/analytics"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>📊</span>
                <span>Analytics</span>
              </a>
            </li>
            <li>
              <a
                href="/posts"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>📝</span>
                <span>Posts</span>
              </a>
            </li>
            <li>
              <a
                href="/posts/calendar"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>📅</span>
                <span>Calendar</span>
              </a>
            </li>
            <li>
              <a
                href="/social/accounts"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>🔗</span>
                <span>Channels</span>
              </a>
            </li>
            <li>
              <a
                href="/links"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>🔗</span>
                <span>Links</span>
              </a>
            </li>
            <li>
              <a
                href="/evergreen"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>🔄</span>
                <span>Evergreen</span>
              </a>
            </li>
            <li>
              <a
                href="/billing"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>💳</span>
                <span>Billing</span>
              </a>
            </li>
            <li>
              <a
                href="/workspaces"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span>⚙️</span>
                <span>Workspaces</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  );
};
