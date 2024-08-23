import React, { useMemo, useEffect } from 'react';
import { useLaunchParams, useCloudStorage } from '@telegram-apps/sdk-react';
import { useQuery, useMutation } from '@tanstack/react-query';
//import LoadingSpinner from '@/utils/LoadingSpinner';
import { initMiniApp } from '@/api';
import Calendar from '@/screens/Calendar/Calendar';
import Home from '@/screens/Home/Home';
import Onboarding from '@/screens/Onboarding/Onboarding';
import { cacheWithCloudStorage } from '@/utils/cacheWithCloudStorage';
import { LanguageProvider } from '@/utils/LanguageContext';
import { getSupportedLanguageCode } from '@/utils/i18n';
import { TelegramInitData, InitMiniAppResponse } from '@/types/Types';
import ErrorDisplay from '@/utils/ErrorDisplay';
import { useGlobalContext } from '@/context/GlobalContext';

const INIT_QUERY_KEY = 'initData';
const ONBOARDING_STATUS_KEY = 'hasCompletedOnboarding';
const ERROR_MESSAGES = {
	INIT_DATA_RAW_UNAVAILABLE: 'error.initDataRawUnavailable',
	TOKEN_MISSING: 'error.tokenMissing',
	UNKNOWN: 'error.unknown',
} as const;

const InitializerPage: React.FC = () => {
	const { initDataRaw } = useLaunchParams();
	const cloudStorage = useCloudStorage();
	const { token, setToken, language, setLanguage } = useGlobalContext();
	const cache = useMemo(() => cacheWithCloudStorage(cloudStorage), [cloudStorage]);

	const {
		isLoading: isInitLoading,
		isError,
		error,
		data,
		refetch,
	} = useQuery<InitMiniAppResponse, Error, InitMiniAppResponse, [string, TelegramInitData]>({
		queryKey: [INIT_QUERY_KEY, { init_data_raw: initDataRaw || '' }],
		queryFn: ({ queryKey }) => initMiniApp(queryKey[1]),
		enabled: !!initDataRaw,
		retry: false,
		staleTime: Infinity,
	});

	const {
		data: isOnboardingComplete,
		isLoading: isStatusLoading,
		refetch: refetchOnboarding,
	} = useQuery<boolean, Error>({
		queryKey: ['onboardingStatus'],
		queryFn: async () => {
			const status = await cache.get<boolean>(ONBOARDING_STATUS_KEY);
			return status ?? false;
		},
		retry: 1,
	});

	const setOnboardingComplete = useMutation({
		mutationFn: async (completed: boolean) => {
			await cache.set(ONBOARDING_STATUS_KEY, completed);
		},
		onSuccess: () => refetchOnboarding(),
	});

	useEffect(() => {
		if (data) {
			setToken(data.token);
			setLanguage(getSupportedLanguageCode(data.user.language_code));
		}
	}, [data, setToken, setLanguage]);

	const errorMessage = useMemo(() => {
		if (isError) return error?.message || ERROR_MESSAGES.UNKNOWN;
		if (!data?.token) return ERROR_MESSAGES.TOKEN_MISSING;
		return null;
	}, [isError, error, data]);

	/*if (isInitLoading || isStatusLoading) {
		return <LoadingSpinner />;
		}*/

	if (errorMessage) {
		return <ErrorDisplay message={errorMessage} onRetry={refetch} />;
	}

	if (!token) {
		return <ErrorDisplay message={ERROR_MESSAGES.TOKEN_MISSING} onRetry={refetch} />;
	}

	return (
		<LanguageProvider languageCode={language}>
			{data?.start_page === 'calendar' && data.start_param ? (
				<Calendar token={token} apiRef={data.start_param} />
			) : isOnboardingComplete ? (
				<Home />
			) : (
				<Onboarding onComplete={() => setOnboardingComplete.mutate(true)} />
			)}
		</LanguageProvider>
	);
};

export default InitializerPage;
