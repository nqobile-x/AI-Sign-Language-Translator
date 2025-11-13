
import React from 'react';
import { Tab } from '../types';

interface TabItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, setActiveTab }) => {
  return (
    <div className="flex justify-center space-x-2 md:space-x-4 bg-gray-900/50 p-2 rounded-full border border-gray-700">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`
            flex items-center justify-center w-full px-4 py-2 text-sm md:text-base font-medium rounded-full
            transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500
            ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }
          `}
        >
          {tab.icon}
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default Tabs;
