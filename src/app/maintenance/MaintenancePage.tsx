// src/app/maintenance/MaintenancePage.tsx
import { motion } from 'framer-motion';
import { where, orderBy } from 'firebase/firestore';
import { Calendar, CheckCircle2, Clock, Droplets, Scissors, Sprout, Wrench, Snowflake } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, cn } from '@/lib/utils';
import type { MaintenanceSchedule } from '@/types';
import { format, isFuture, isPast, isToday, addDays } from 'date-fns';

const serviceIcons: Record<string, React.ElementType> = {
  Mowing: Scissors,
  Irrigation: Droplets,
  Fertilizing: Sprout,
  Pruning: Scissors,
  'Snow Removal': Snowflake,
  Repair: Wrench,
};

function getServiceIcon(type: string): React.ElementType {
  return serviceIcons[type] ?? Calendar;
}

export function MaintenancePage() {
  const { user } = useAuth();

  const { data: schedules } = useCollection<MaintenanceSchedule>(
    'maintenance',
    where('clientId', '==', user?.uid ?? ''),
    orderBy('nextDate', 'asc')
  );

  const upcoming = schedules.filter((s) => isFuture(new Date(s.nextDate)));
  const todayItems = schedules.filter((s) => isToday(new Date(s.nextDate)));
  const completed = schedules.filter((s) => s.completedAt);

  const thisMonth = upcoming.filter(
    (s) => new Date(s.nextDate) <= addDays(new Date(), 30)
  );

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">Maintenance Schedule</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track your recurring landscape services
        </p>
      </div>

      {/* Today's visits */}
      {todayItems.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-5 text-white">
            <p className="text-white/70 text-sm mb-1">Today</p>
            <h2 className="text-xl font-semibold mb-3">
              {todayItems.length} service visit{todayItems.length > 1 ? 's' : ''} scheduled
            </h2>
            <div className="space-y-2">
              {todayItems.map((s) => {
                const Icon = getServiceIcon(s.type);
                return (
                  <div key={s.id} className="bg-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <div>
                      <p className="font-medium">{s.type}</p>
                      {s.crewName && <p className="text-white/70 text-xs">{s.crewName} is coming</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Calendar-style upcoming */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Upcoming This Month
            {thisMonth.length > 0 && (
              <Badge variant="info" className="ml-2">{thisMonth.length}</Badge>
            )}
          </h2>

          {thisMonth.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No scheduled visits this month</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {thisMonth.map((schedule, i) => {
                const date = new Date(schedule.nextDate);
                const Icon = getServiceIcon(schedule.type);
                return (
                  <motion.div
                    key={schedule.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Card className="card-hover">
                      <CardContent className="pt-4 pb-4 flex gap-4">
                        {/* Date block */}
                        <div className="w-14 h-14 bg-primary-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                          <p className="text-xs font-medium text-primary-600">{format(date, 'MMM').toUpperCase()}</p>
                          <p className="text-2xl font-bold text-primary-700 leading-none">{format(date, 'd')}</p>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-primary-600 flex-shrink-0" />
                            <p className="font-semibold text-sm">{schedule.type}</p>
                          </div>
                          {schedule.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{schedule.description}</p>
                          )}
                          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                            {schedule.crewName && <span>👷 {schedule.crewName}</span>}
                            <span className="capitalize">{schedule.frequency}</span>
                          </div>
                        </div>

                        <Badge
                          variant={isToday(date) ? 'gold' : isFuture(date) ? 'info' : 'success'}
                          className="self-start"
                        >
                          {isToday(date) ? 'Today' : isFuture(date) ? 'Upcoming' : 'Done'}
                        </Badge>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed history */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Completed Services
            {completed.length > 0 && (
              <Badge variant="success" className="ml-2">{completed.length}</Badge>
            )}
          </h2>
          {completed.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No completed services yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {completed.slice(0, 8).map((s) => {
                const Icon = getServiceIcon(s.type);
                return (
                  <Card key={s.id}>
                    <CardContent className="pt-3 pb-3 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.type}</p>
                        <p className="text-xs text-muted-foreground">
                          Completed {s.completedAt ? formatDate(s.completedAt) : ''}
                        </p>
                      </div>
                      {s.photoProof && (
                        <a href={s.photoProof} target="_blank" rel="noreferrer">
                          <img src={s.photoProof} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        </a>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
