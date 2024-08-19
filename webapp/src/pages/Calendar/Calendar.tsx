import React, { useState, useMemo, useEffect } from 'react';
import { useMiniApp } from '@telegram-apps/sdk-react';
import { DayPicker } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@telegram-apps/telegram-ui';
import { getCalendarByRef } from '@/api';
import { CalendarType, CalendarProps } from '@/types/types';
import 'react-day-picker/dist/style.css';

const Calendar: React.FC<CalendarProps> = ({ token, apiRef }) => {
	const miniapp = useMiniApp();
	const { data, error } = useQuery<{ calendar: CalendarType }, Error>({
		queryKey: ['calendar', apiRef],
		queryFn: () => getCalendarByRef(token, apiRef),
	});

	const enabledDates = useMemo(() => {
		return data?.calendar?.dates?.map(dateStr => new Date(dateStr)) || [];
	}, [data]);

	const [selectedDates, setSelectedDates] = useState<Date[]>([]);

	useEffect(() => {
		miniapp.ready();
	}, [miniapp]);

	if (error) return <Text color="red">Error loading calendar: {error.message}</Text>;

	if (!enabledDates.length) return null;

	return (
		<div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
			<h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Pick out of proposed dates</h2>
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
			/>
		</div>
	);
};

export default Calendar;
