import React from 'react';
import { RouteObject } from 'react-router-dom';
import InitializerPage from '@/pages/InitializerPage/InitializerPage';

export const routes: RouteObject[] = [
	{
		path: '*',
		element: <InitializerPage />,
		// All routes are handled by InitializerPage, centralizing initialization and routing logic
	},
];
