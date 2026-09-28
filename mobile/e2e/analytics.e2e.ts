/**
 * Analytics E2E Tests
 * Comprehensive testing for analytics dashboard, charts, and reports
 */

import { device, element, by, expect as detoxExpect } from 'detox';

describe('Analytics Dashboard Tests', () => {
  beforeAll(async () => {
    await device.launchApp();
    await device.setBiometricEnrollment(true);
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Dashboard Rendering', () => {
    it('should display analytics dashboard with all KPI cards', async () => {
      await element(by.id('analytics-tab')).multiTap();

      await detoxExpect(element(by.text('Analytics Dashboard'))).toBeVisible();
      await detoxExpect(element(by.text('Key Performance Indicators'))).toBeVisible();
      await detoxExpect(element(by.id('kpi-production'))).toBeVisible();
      await detoxExpect(element(by.id('kpi-efficiency'))).toBeVisible();
      await detoxExpect(element(by.id('kpi-costs'))).toBeVisible();
      await detoxExpect(element(by.id('kpi-capacity'))).toBeVisible();
    });

    it('should display period selector buttons', async () => {
      await element(by.id('analytics-tab')).multiTap();

      await detoxExpect(element(by.text('7D'))).toBeVisible();
      await detoxExpect(element(by.text('30D'))).toBeVisible();
      await detoxExpect(element(by.text('90D'))).toBeVisible();
      await detoxExpect(element(by.text('Year'))).toBeVisible();
    });

    it('should display production trend chart', async () => {
      await element(by.id('analytics-tab')).multiTap();
      await element(by.id('scroll-view')).scrollTo('bottom');

      await detoxExpect(element(by.id('production-trend-chart'))).toBeVisible();
    });

    it('should display efficiency gauge chart', async () => {
      await element(by.id('analytics-tab')).multiTap();
      await element(by.id('scroll-view')).scrollTo('bottom');

      await detoxExpect(element(by.id('efficiency-gauge-chart'))).toBeVisible();
    });
  });

  describe('Period Selection', () => {
    it('should update charts when changing period to 7 days', async () => {
      await element(by.id('analytics-tab')).multiTap();
      await element(by.text('7D')).multiTap();

      await new Promise(r => setTimeout(r, 1000));
      await detoxExpect(element(by.id('production-trend-chart'))).toBeVisible();
    });

    it('should update charts when changing period to 30 days', async () => {
      await element(by.id('analytics-tab')).multiTap();
      await element(by.text('30D')).multiTap();

      await new Promise(r => setTimeout(r, 1000));
      await detoxExpect(element(by.id('production-trend-chart'))).toBeVisible();
    });

    it('should update charts when changing period to 90 days', async () => {
      await element(by.id('analytics-tab')).multiTap();
      await element(by.text('90D')).multiTap();

      await new Promise(r => setTimeout(r, 1000));
      await detoxExpect(element(by.id('production-trend-chart'))).toBeVisible();
    });

    it('should update charts when changing period to year', async () => {
      await element(by.id('analytics-tab')).multiTap();
      await element(by.text('Year')).multiTap();

      await new Promise(r => setTimeout(r, 1000));
      await detoxExpect(element(by.id('production-trend-chart'))).toBeVisible();
    });
  });

  describe('Navigation to Detail Screens', () => {
    it('should navigate to Production Analytics when tapping production button', async () => {
      await element(by.id('analytics-tab')).multiTap();
      await element(by.id('scroll-view')).scrollTo('bottom');
      await element(by.text('Production')).multiTap();

      await detoxExpect(element(by.text('Production Analytics'))).toBeVisible();
    });

    it('should navigate to Efficiency Analytics when tapping efficiency button', async () => {
      await element(by.id('analytics-tab')).multiTap();
      await element(by.id('scroll-view')).scrollTo('bottom');
      await element(by.text('Efficiency')).multiTap();

      await detoxExpect(element(by.text('Efficiency Analytics'))).toBeVisible();
    });

    it('should navigate to Cost Analytics when tapping costs button', async () => {
      await element(by.id('analytics-tab')).multiTap();
      await element(by.id('scroll-view')).scrollTo('bottom');
      await element(by.text('Costs')).multiTap();

      await detoxExpect(element(by.text('Cost Analytics'))).toBeVisible();
    });

    it('should navigate to Forecast Analytics when tapping forecast button', async () => {
      await element(by.id('analytics-tab')).multiTap();
      await element(by.id('scroll-view')).scrollTo('bottom');
      await element(by.text('Forecast')).multiTap();

      await detoxExpect(element(by.text('Forecast Analytics'))).toBeVisible();
    });
  });
});

describe('Production Analytics Tests', () => {
  beforeEach(async () => {
    await element(by.id('analytics-tab')).multiTap();
    await element(by.id('scroll-view')).scrollTo('bottom');
    await element(by.text('Production')).multiTap();
  });

  it('should display production summary stats', async () => {
    await detoxExpect(element(by.text('Total Production'))).toBeVisible();
    await detoxExpect(element(by.text('Average'))).toBeVisible();
    await detoxExpect(element(by.text('Peak'))).toBeVisible();
  });

  it('should display production trend line chart', async () => {
    await detoxExpect(element(by.id('production-trend-line-chart'))).toBeVisible();
  });

  it('should display production vs target bar chart', async () => {
    await detoxExpect(element(by.id('production-vs-target-chart'))).toBeVisible();
  });

  it('should display monthly breakdown with progress bars', async () => {
    await element(by.id('scroll-view')).scrollTo('bottom');
    await detoxExpect(element(by.id('month-jan'))).toBeVisible();
    await detoxExpect(element(by.id('month-feb'))).toBeVisible();
    await detoxExpect(element(by.id('month-mar'))).toBeVisible();
  });

  it('should go back when tapping back button', async () => {
    await element(by.id('header-back-button')).multiTap();
    await detoxExpect(element(by.text('Analytics Dashboard'))).toBeVisible();
  });
});

describe('Efficiency Analytics Tests', () => {
  beforeEach(async () => {
    await element(by.id('analytics-tab')).multiTap();
    await element(by.id('scroll-view')).scrollTo('bottom');
    await element(by.text('Efficiency')).multiTap();
  });

  it('should display efficiency gauge chart', async () => {
    await detoxExpect(element(by.id('efficiency-gauge-chart'))).toBeVisible();
  });

  it('should display performance summary stats', async () => {
    await detoxExpect(element(by.text('Average'))).toBeVisible();
    await detoxExpect(element(by.text('Target'))).toBeVisible();
    await detoxExpect(element(by.text('Variance'))).toBeVisible();
  });

  it('should display efficiency trend line chart', async () => {
    await detoxExpect(element(by.id('efficiency-trend-chart'))).toBeVisible();
  });

  it('should display radar chart for system performance', async () => {
    await element(by.id('scroll-view')).scrollTo('bottom');
    await detoxExpect(element(by.id('radar-performance-chart'))).toBeVisible();
  });

  it('should display performance alerts', async () => {
    await element(by.id('scroll-view')).scrollTo('bottom');
    await detoxExpect(element(by.text('Performance Alerts'))).toBeVisible();
  });
});

describe('Cost Analytics Tests', () => {
  beforeEach(async () => {
    await element(by.id('analytics-tab')).multiTap();
    await element(by.id('scroll-view')).scrollTo('bottom');
    await element(by.text('Costs')).multiTap();
  });

  it('should display budget summary', async () => {
    await detoxExpect(element(by.text('Budget Allocated'))).toBeVisible();
    await detoxExpect(element(by.text('Total Spent'))).toBeVisible();
    await detoxExpect(element(by.text('Variance'))).toBeVisible();
  });

  it('should display spending by category pie chart', async () => {
    await detoxExpect(element(by.id('pie-chart-spending'))).toBeVisible();
  });

  it('should display monthly budget vs actual bar chart', async () => {
    await element(by.id('scroll-view')).scrollTo('bottom');
    await detoxExpect(element(by.id('budget-vs-actual-chart'))).toBeVisible();
  });

  it('should display category breakdown with progress bars', async () => {
    await element(by.id('scroll-view')).scrollTo('bottom');
    await detoxExpect(element(by.id('category-operations'))).toBeVisible();
    await detoxExpect(element(by.id('category-maintenance'))).toBeVisible();
  });

  it('should show budget status badges', async () => {
    await element(by.id('scroll-view')).scrollTo('bottom');
    const badges = element(by.text(/Under|Over/));
    await detoxExpect(badges).toExist();
  });
});

describe('Forecast Analytics Tests', () => {
  beforeEach(async () => {
    await element(by.id('analytics-tab')).multiTap();
    await element(by.id('scroll-view')).scrollTo('bottom');
    await element(by.text('Forecast')).multiTap();
  });

  it('should display 6-month forecast summary', async () => {
    await detoxExpect(element(by.text('6-Month Forecast'))).toBeVisible();
    await detoxExpect(element(by.text('Current'))).toBeVisible();
    await detoxExpect(element(by.text('Forecast (Oct)'))).toBeVisible();
  });

  it('should display production trend and forecast line chart', async () => {
    await detoxExpect(element(by.id('forecast-trend-chart'))).toBeVisible();
  });

  it('should display seasonal pattern area chart', async () => {
    await element(by.id('scroll-view')).scrollTo('bottom');
    await detoxExpect(element(by.id('seasonal-pattern-chart'))).toBeVisible();
  });

  it('should display forecast trends', async () => {
    await element(by.id('scroll-view')).scrollTo('bottom');
    await detoxExpect(element(by.text('Forecast Trends'))).toBeVisible();
    await detoxExpect(element(by.id('trend-production'))).toBeVisible();
    await detoxExpect(element(by.id('trend-efficiency'))).toBeVisible();
  });

  it('should display key insights', async () => {
    await element(by.id('scroll-view')).scrollTo('bottom');
    await detoxExpect(element(by.text('Key Insights'))).toBeVisible();
  });
});

describe('Reports Export Tests', () => {
  beforeEach(async () => {
    await element(by.id('analytics-tab')).multiTap();
    await element(by.id('scroll-view')).scrollTo('bottom');
    await element(by.text('Reports')).multiTap();
  });

  it('should display report generation section', async () => {
    await detoxExpect(element(by.text('Generate New Report'))).toBeVisible();
    await detoxExpect(element(by.text('Select Template'))).toBeVisible();
  });

  it('should allow selecting report templates', async () => {
    await element(by.id('template-comprehensive')).multiTap();
    await detoxExpect(element(by.id('template-comprehensive'))).toHaveAttr('selected', 'true');
  });

  it('should allow entering date range', async () => {
    await element(by.id('start-date-input')).typeText('2026-06-01');
    await element(by.id('end-date-input')).typeText('2026-06-30');

    await detoxExpect(element(by.id('start-date-input'))).toHaveToggleValue(true);
  });

  it('should allow selecting export format', async () => {
    await element(by.id('format-pdf')).multiTap();
    await detoxExpect(element(by.id('format-pdf'))).toHaveAttr('selected', 'true');
  });

  it('should generate report when tapping generate button', async () => {
    await element(by.id('start-date-input')).typeText('2026-06-01');
    await element(by.id('end-date-input')).typeText('2026-06-30');
    await element(by.text('Generate Report')).multiTap();

    await new Promise(r => setTimeout(r, 3000));
    await detoxExpect(element(by.text('Report generated successfully'))).toBeVisible();
  });

  it('should display generated reports list', async () => {
    await detoxExpect(element(by.text('Recent Reports'))).toBeVisible();
  });

  it('should allow downloading reports', async () => {
    await element(by.id('scroll-view')).scrollTo('bottom');
    await element(by.id('report-download-1')).multiTap();

    await detoxExpect(element(by.text(/Downloading|Download/))).toBeVisible();
  });
});

describe('Chart Rendering Performance', () => {
  beforeEach(async () => {
    await element(by.id('analytics-tab')).multiTap();
  });

  it('should render all charts within 2 seconds', async () => {
    const startTime = Date.now();

    await detoxExpect(element(by.id('production-trend-chart'))).toBeVisible();
    await detoxExpect(element(by.id('efficiency-gauge-chart'))).toBeVisible();

    const endTime = Date.now();
    const renderTime = endTime - startTime;

    expect(renderTime).toBeLessThan(2000);
  });

  it('should handle large datasets without crashing', async () => {
    await element(by.id('analytics-tab')).multiTap();
    await element(by.text('Year')).multiTap();

    await new Promise(r => setTimeout(r, 1500));
    await detoxExpect(element(by.id('production-trend-chart'))).toBeVisible();
  });
});
