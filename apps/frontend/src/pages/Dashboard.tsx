export const DashboardPage = () => {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        Welcome to Social Media Scheduler
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Posts
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your scheduled posts
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Analytics
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            View performance metrics
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Accounts
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Connect social media accounts
          </p>
        </div>
      </div>
    </div>
  );
};
