/**
 * MilestoneGantt: Interactive Gantt chart showing project milestones and slippage
 */

import { Card, CardHeader, CardBody } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Milestone {
  id: string;
  name: string;
  originalDate: string; // ISO date
  currentDate: string; // ISO date
  status: 'ontime' | 'warning' | 'critical';
}

interface MilestoneGanttProps {
  projectName: string;
  milestones: Milestone[];
}

/**
 * MilestoneGantt: Visual timeline with slippage indicators
 */
export function MilestoneGantt({ projectName, milestones }: MilestoneGanttProps) {
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);

  // Calculate days slipped
  const getSlippage = (milestone: Milestone) => {
    const original = new Date(milestone.originalDate);
    const current = new Date(milestone.currentDate);
    const daysDiff = Math.ceil((current.getTime() - original.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff;
  };

  // Determine status based on slippage
  const getStatus = (daysDiff: number): 'ontime' | 'warning' | 'critical' => {
    if (daysDiff <= 0) return 'ontime';
    if (daysDiff <= 180) return 'warning'; // 6 months
    return 'critical'; // >6 months
  };

  // Calculate timeline range
  const allDates = milestones.flatMap(m => [
    new Date(m.originalDate),
    new Date(m.currentDate)
  ]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const timelineRange = maxDate.getTime() - minDate.getTime();

  const getPosition = (date: string) => {
    const dateTime = new Date(date).getTime();
    return ((dateTime - minDate.getTime()) / timelineRange) * 100;
  };

  return (
    <Card>
      <CardHeader title="Project Timeline & Milestones" />
      <CardBody>
        <div className="space-y-6">
          {/* Timeline Header */}
          <div className="text-xs text-muted font-mono">
            {minDate.toISOString().split('T')[0]} → {maxDate.toISOString().split('T')[0]}
          </div>

          {/* Gantt Bars */}
          <div className="space-y-4">
            {milestones.map((milestone) => {
              const slippage = getSlippage(milestone);
              const status = getStatus(slippage);
              const originalPos = getPosition(milestone.originalDate);
              const currentPos = getPosition(milestone.currentDate);

              return (
                <div
                  key={milestone.id}
                  className={`rounded-lg border transition-colors cursor-pointer ${
                    selectedMilestone === milestone.id
                      ? 'border-primary bg-primary/5'
                      : 'border-line hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedMilestone(
                    selectedMilestone === milestone.id ? null : milestone.id
                  )}
                >
                  {/* Milestone Label & Status */}
                  <div className="px-4 py-2 flex items-center justify-between border-b border-line">
                    <div className="flex items-center gap-2">
                      {status === 'ontime' && <CheckCircle className="size-4 text-success" />}
                      {status === 'warning' && <Clock className="size-4 text-warning" />}
                      {status === 'critical' && <AlertTriangle className="size-4 text-danger" />}
                      <span className="font-medium text-fg">{milestone.name}</span>
                    </div>
                    <Badge
                      tone={status === 'ontime' ? 'success' : status === 'warning' ? 'warning' : 'error'}
                      className="text-xs"
                    >
                      {slippage === 0 ? 'On Time' : `${slippage} days late`}
                    </Badge>
                  </div>

                  {/* Timeline Visualization */}
                  <div className="px-4 py-3">
                    <div className="relative h-8 bg-surface-2 rounded">
                      {/* Baseline (Original Date) */}
                      <div
                        className="absolute top-1 h-3 w-0.5 bg-muted"
                        style={{ left: `${originalPos}%` }}
                        title={`Original: ${milestone.originalDate}`}
                      />

                      {/* Actual (Current Date) - Only show if different */}
                      {slippage !== 0 && (
                        <>
                          {/* Slippage Bar */}
                          <div
                            className={`absolute top-1 h-3 transition-all ${
                              status === 'ontime'
                                ? 'bg-success'
                                : status === 'warning'
                                  ? 'bg-warning'
                                  : 'bg-danger'
                            }`}
                            style={{
                              left: `${originalPos}%`,
                              width: `${Math.abs(currentPos - originalPos)}%`,
                              opacity: 0.6,
                            }}
                            title={`Slippage: ${slippage} days`}
                          />

                          {/* Current Position Marker */}
                          <div
                            className={`absolute top-0.5 -ml-1 w-4 h-7 border-2 rounded ${
                              status === 'ontime'
                                ? 'border-success'
                                : status === 'warning'
                                  ? 'border-warning'
                                  : 'border-danger'
                            }`}
                            style={{ left: `${currentPos}%` }}
                            title={`Current: ${milestone.currentDate}`}
                          />
                        </>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-muted">
                      <div>
                        <p className="font-medium">Original COD</p>
                        <p className="font-mono">{milestone.originalDate}</p>
                      </div>
                      <div>
                        <p className="font-medium">Current RCOD</p>
                        <p className="font-mono">{milestone.currentDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="rounded-lg bg-surface-2 p-3 text-xs space-y-2">
            <p className="font-medium text-fg">Legend</p>
            <div className="space-y-1 text-muted">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-success" />
                <span>On Time (≤ 0 days)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-warning" />
                <span>Warning (1-180 days late)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-danger" />
                <span>Critical (&gt; 180 days late)</span>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
