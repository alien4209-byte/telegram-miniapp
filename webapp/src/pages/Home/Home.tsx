import React, { useState, lazy, Suspense, useEffect } from 'react';
import { Tabbar } from '@telegram-apps/telegram-ui';
import { useMainButton } from '@telegram-apps/sdk-react';
import styles from '@/pages/Home/Home.module.css';

// Lazy load page components
const DateSelection = lazy(() => import('@/pages/DateSelection/DateSelection'));
const Calendar = lazy(() => import('@/pages/Invite/Invite'));
const Settings = lazy(() => import('@/pages/Search/Search'));

// Define tabs configuration
const tabConfig = [
	{ id: 'dates', icon: '📅', component: DateSelection },
	{ id: 'calendar', icon: '🗓️', component: Calendar },
	{ id: 'settings', icon: '⚙️', component: Settings },
];

const Home: React.FC<{ token: string }> = ({ token }) => {
	const [currentTab, setCurrentTab] = useState(tabConfig[0].id);
	const [isTabbarVisible, setIsTabbarVisible] = useState(true);
	const mainButton = useMainButton();

	const ActiveComponent =
		tabConfig.find(tab => tab.id === currentTab)?.component || tabConfig[0].component;

	useEffect(() => {
		const handleMainButtonVisibilityChange = (isVisible: boolean) => {
			setIsTabbarVisible(!isVisible);
		};

		// Initial check
		handleMainButtonVisibilityChange(mainButton.isVisible);

		// Subscribe to MainButton visibility changes
		mainButton.on('change:isVisible', handleMainButtonVisibilityChange);

		// Cleanup
		return () => {
			mainButton.off('change:isVisible', handleMainButtonVisibilityChange);
		};
	}, [mainButton]);

	return (
		<div className={styles.container}>
			<Suspense fallback={<div>Loading...</div>}>
				<ActiveComponent token={token} />
			</Suspense>

			<Tabbar className={`${styles.tabbar} ${!isTabbarVisible ? styles.tabbarHidden : ''}`}>
				{tabConfig.map(({ id, icon }) => (
					<Tabbar.Item
						key={id}
						text={id.charAt(0).toUpperCase() + id.slice(1)}
						selected={id === currentTab}
						onClick={() => setCurrentTab(id)}
					>
						<div style={{ width: 28, height: 28 }}>{icon}</div>
					</Tabbar.Item>
				))}
			</Tabbar>
		</div>
	);
};

export default Home;
