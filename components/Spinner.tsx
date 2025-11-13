
import React from 'react';

const Spinner: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-4">
      <div className="w-16 h-16 border-4 border-blue-400 border-dashed rounded-full animate-spin border-t-transparent"></div>
      <p className="mt-4 text-lg font-semibold text-gray-300">{message}</p>
    </div>
  );
};

export default Spinner;
