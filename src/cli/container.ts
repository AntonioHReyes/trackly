import { SqliteConnection } from "../infrastructure/db/SqliteConnection.js";
import { SqliteBackup } from "../infrastructure/db/SqliteBackup.js";
import { SqliteWorkspaceRepository } from "../infrastructure/repositories/SqliteWorkspaceRepository.js";
import { SqliteProjectRepository } from "../infrastructure/repositories/SqliteProjectRepository.js";
import { SqliteTagRepository } from "../infrastructure/repositories/SqliteTagRepository.js";
import { SqliteTimeEntryRepository } from "../infrastructure/repositories/SqliteTimeEntryRepository.js";
import { ConfigStore } from "../infrastructure/config/ConfigStore.js";
import { StateStore } from "../infrastructure/config/StateStore.js";
import { ReportPresetStore } from "../infrastructure/config/ReportPresetStore.js";
import { InvoiceConfigStore } from "../infrastructure/config/InvoiceConfigStore.js";
import { defaultDbPath } from "../infrastructure/config/paths.js";
import { WorkspaceService } from "../application/services/WorkspaceService.js";
import { ProjectService } from "../application/services/ProjectService.js";
import { TagService } from "../application/services/TagService.js";
import { TimeEntryService } from "../application/services/TimeEntryService.js";
import { ReportService } from "../application/services/ReportService.js";
import { InvoiceService } from "../application/services/InvoiceService.js";
import { PdfReportExporter } from "../infrastructure/reporting/PdfReportExporter.js";
import { CsvReportExporter } from "../infrastructure/reporting/CsvReportExporter.js";
import { PdfInvoiceExporter } from "../infrastructure/reporting/PdfInvoiceExporter.js";

/**
 * The single composition root (see PLAN.md) — every infra implementation is
 * instantiated here and wired into application services. No other file does
 * `new SqliteXRepository()` or opens a DB connection directly.
 */
export class Container {
  readonly connection: SqliteConnection;
  readonly configStore: ConfigStore;
  readonly reportPresetStore: ReportPresetStore;
  readonly invoiceConfigStore: InvoiceConfigStore;
  readonly backup: SqliteBackup;

  readonly workspaceService: WorkspaceService;
  readonly projectService: ProjectService;
  readonly tagService: TagService;
  readonly timeEntryService: TimeEntryService;
  readonly reportService: ReportService;
  readonly invoiceService: InvoiceService;
  readonly pdfReportExporter: PdfReportExporter;
  readonly csvReportExporter: CsvReportExporter;
  readonly pdfInvoiceExporter: PdfInvoiceExporter;

  constructor() {
    this.configStore = new ConfigStore();
    this.reportPresetStore = new ReportPresetStore();
    this.invoiceConfigStore = new InvoiceConfigStore();
    const dbPath = this.configStore.read().dbPath ?? defaultDbPath();
    this.connection = new SqliteConnection(dbPath);
    this.backup = new SqliteBackup(this.connection);

    const workspaces = new SqliteWorkspaceRepository(this.connection.db);
    const projects = new SqliteProjectRepository(this.connection.db);
    const tags = new SqliteTagRepository(this.connection.db);
    const timeEntries = new SqliteTimeEntryRepository(this.connection.db);
    const activeWorkspaceStore = new StateStore();

    this.workspaceService = new WorkspaceService(workspaces, activeWorkspaceStore);
    this.projectService = new ProjectService(projects);
    this.tagService = new TagService(tags);
    this.timeEntryService = new TimeEntryService(timeEntries, projects, workspaces);
    this.reportService = new ReportService(timeEntries, projects, tags);
    this.invoiceService = new InvoiceService(this.reportService);
    this.pdfReportExporter = new PdfReportExporter();
    this.csvReportExporter = new CsvReportExporter();
    this.pdfInvoiceExporter = new PdfInvoiceExporter();
  }

  close(): void {
    this.connection.close();
  }
}
