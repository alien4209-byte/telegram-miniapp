import React, { useMemo, useEffect } from 'react';
import { useLaunchParams, useCloudStorage } from '@telegram-apps/sdk-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import LoadingSpinner from '@/utils/loadingSpinner';
import { initMiniApp } from '@/api';
import Calendar from '@/pages/Calendar/Calendar';
import Home from '@/pages/Home/Home';
import Onboarding from '@/pages/Onboarding/Onboarding';
import { cacheWithCloudStorage } from '@/utils/cacheWithCloudStorage';
import { LanguageProvider } from '@/utils/LanguageContext';
import { getSupportedLanguageCode } from '@/utils/i18n';
import { TelegramInitData, InitMiniAppResponse } from '@/types/types';
import ErrorDisplay from '@/utils/ErrorDisplay';

const INIT_QUERY_KEY = 'initData';
const ONBOARDING_STATUS_KEY = 'hasCompletedOnboarding';
const ERROR_MESSAGES = {
	INIT_DATA_RAW_UNAVAILABLE: 'error.initDataRawUnavailable',
	TOKEN_MISSING: 'error.tokenMissing',
	UNKNOWN: 'error.unknown',
} as const;

const useInitMiniApp = () => {
	const { initDataRaw } = useLaunchParams();
	return useQuery<InitMiniAppResponse, Error, InitMiniAppResponse, [string, TelegramInitData]>({
		queryKey: [INIT_QUERY_KEY, { init_data_raw: initDataRaw || '' }],
		queryFn: ({ queryKey }) => initMiniApp(queryKey[1]),
		enabled: !!initDataRaw,
		retry: false,
		staleTime: Infinity,
	});
};

const useOnboardingStatus = () => {
	const cloudStorage = useCloudStorage();
	const cache = useMemo(() => cacheWithCloudStorage(cloudStorage), [cloudStorage]);
	const {
		data: isOnboardingComplete,
		isLoading,
		error,
		refetch,
	} = useQuery<boolean, Error>({
		queryKey: ['onboardingStatus'],
		queryFn: async () => {
			const status = await cache.get<boolean>(ONBOARDING_STATUS_KEY);
			// Temporary override: always return false
			return false;
			// Comment out or remove the line below when you want to revert to normal behavior
			// return status ?? false;
		},
		retry: 1,
	});

	const setOnboardingComplete = useMutation({
		mutationFn: async (completed: boolean) => {
			await cache.set(ONBOARDING_STATUS_KEY, completed);
		},
		onSuccess: () => refetch(),
	});

	return {
		isOnboardingComplete,
		isLoading,
		error,
		setOnboardingComplete: setOnboardingComplete.mutate,
	};
};

const InitializerPage: React.FC = () => {
	const { isLoading: isInitLoading, isError, error, data, refetch } = useInitMiniApp();
	const {
		isOnboardingComplete,
		isLoading: isStatusLoading,
		setOnboardingComplete,
	} = useOnboardingStatus();

	const errorMessage = useMemo(() => {
		if (isError) return error?.message || ERROR_MESSAGES.UNKNOWN;
		if (!data?.token) return ERROR_MESSAGES.TOKEN_MISSING;
		return null;
	}, [isError, error, data]);

	const languageCode = useMemo(() => {
		if (data?.user.language_code) {
			return getSupportedLanguageCode(data.user.language_code);
		}
		return 'en';
	}, [data]);

	useEffect(() => {
		console.log('InitMiniApp Data:', data);
		console.log('start_page:', data?.start_page);
		console.log('start_param:', data?.start_param);
		console.log('isOnboardingComplete:', isOnboardingComplete);
	}, [data, isOnboardingComplete]);

	if (isInitLoading || isStatusLoading) {
		return <LoadingSpinner />;
	}

	if (errorMessage) {
		return <ErrorDisplay message={errorMessage} onRetry={refetch} />;
	}

	if (!data || !data.token) {
		return <ErrorDisplay message={ERROR_MESSAGES.TOKEN_MISSING} onRetry={refetch} />;
	}

	return (
		<LanguageProvider languageCode={languageCode}>
			{data.start_page === 'calendar' && data.start_param ? (
				<Calendar token={data.token} apiRef={data.start_param} />
			) : isOnboardingComplete ? (
				<Home token={data.token} />
			) : (
				<Onboarding onComplete={() => setOnboardingComplete(true)} />
			)}
		</LanguageProvider>
	);
};

export default InitializerPage;
