import React, { useState, useMemo, useEffect } from 'react';
import { useMiniApp } from '@telegram-apps/sdk-react';
import { DayPicker } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@telegram-apps/telegram-ui';
import { getCalendarByRef } from '@/services/api';
import { useLanguage } from '@/utils/LanguageContext';
import { useGlobalContext } from '@/context/GlobalContext';
import { CalendarType, CalendarProps } from '@/types/Types';
import 'react-day-picker/dist/style.css';

// Import all locales you need
import { es, ru, ptBR, uk } from 'date-fns/locale';
import Loading from '@/utils/Loading';

const locales: { [key: string]: Locale } = { es, ru, uk, ptBR };

const Calendar: React.FC<CalendarProps> = ({ apiRef }) => {
	const miniapp = useMiniApp();
	const { t, languageCode } = useLanguage();
	const { token } = useGlobalContext();
	const { data, error, isPending } = useQuery<{ calendar: CalendarType }, Error>({
		queryKey: ['calendar', apiRef],
		queryFn: () => getCalendarByRef(token, apiRef),
		enabled: !!token,
	});

	const enabledDates = useMemo(() => {
		return data?.calendar?.dates?.map(dateStr => new Date(dateStr)) || [];
	}, [data]);

	const [selectedDates, setSelectedDates] = useState<Date[]>([]);

	useEffect(() => {
		miniapp.ready();
	}, [miniapp]);

	if (isPending) return <Loading />;
	if (error) return <Text color="red">{t('calendar.errorLoading', { error: error.message })}</Text>;
	if (!enabledDates.length) return <Text>{t('calendar.noProposedDates')}</Text>;

	return (
		<div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
			<h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
				{t('calendar.pickProposedDates')}
			</h2>
			<DayPicker
				mode="multiple"
				weekStartsOn={1}
				selected={selectedDates}
				onSelect={dates => setSelectedDates(dates!)}
				disabled={date =>
					!enabledDates.some(enabledDate => enabledDate.toDateString() === date.toDateString())
				}
				modifiers={{ available: enabledDates }}
				modifiersStyles={{
					available: {
						backgroundColor: 'tomato',
						color: 'white',
						borderRadius: '50%',
					},
				}}
				locale={locales[languageCode] || locales['en']}
			/>
			{selectedDates.length > 0 && (
				<Text>{t('calendar.selectedDatesCount', { count: selectedDates.length })}</Text>
			)}
		</div>
	);
};

export default Calendar;
