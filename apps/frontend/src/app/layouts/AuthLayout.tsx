import { Outlet } from 'react-router-dom';

export const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Social Media Scheduler
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage all your social media in one place
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
};
