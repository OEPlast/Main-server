import { Request, Response } from 'express';
import ContentService from '@/services/content/contentService';

type Result = { message: string; data: unknown; code: number; meta?: unknown };

/** Runs a service call and sends its `{ message, data[, meta] }` with the service's status code. */
const handle =
  (label: string, run: (req: Request) => Promise<Result>) =>
  async (req: Request, res: Response) => {
    try {
      const { message, data, code, meta } = await run(req);
      return res.status(code).json(meta === undefined ? { message, data } : { message, data, meta });
    } catch (error) {
      console.error(`Error in ${label}:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

const num = (v: unknown) => (v == null || v === '' ? undefined : Number(v));
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const id = (req: Request) => String(req.params.id);

const ContentController = {
  // public
  listArticles: handle('listArticles', (req) =>
    ContentService.listPublishedArticles({ page: num(req.query.page), limit: num(req.query.limit), category: str(req.query.category) })
  ),
  getArticle: handle('getArticle', (req) => ContentService.getPublishedArticle(String(req.params.slug))),
  getHome: handle('getHome', () => ContentService.getHomeContent()),
  getFaqs: handle('getFaqs', () => ContentService.listFaqGroups()),
  getLegal: handle('getLegal', (req) => ContentService.getLegalDocument(String(req.params.slug))),
  getSizeChart: handle('getSizeChart', (req) => ContentService.getSizeChart(String(req.params.slug))),

  // admin: articles
  adminListArticles: handle('adminListArticles', (req) =>
    ContentService.listAllArticles({
      page: num(req.query.page),
      limit: num(req.query.limit),
      status: str(req.query.status),
      search: str(req.query.search),
    })
  ),
  adminGetArticle: handle('adminGetArticle', (req) => ContentService.getArticleById(id(req))),
  createArticle: handle('createArticle', (req) => ContentService.createArticle(req.body)),
  updateArticle: handle('updateArticle', (req) => ContentService.updateArticle(id(req), req.body)),
  deleteArticle: handle('deleteArticle', (req) => ContentService.deleteArticle(id(req))),

  // admin: site content
  getSiteContent: handle('getSiteContent', () => ContentService.getSiteContent()),
  updateSiteContent: handle('updateSiteContent', (req) => ContentService.updateSiteContent(req.body)),

  // admin: FAQs
  createFaqGroup: handle('createFaqGroup', (req) => ContentService.createFaqGroup(req.body)),
  updateFaqGroup: handle('updateFaqGroup', (req) => ContentService.updateFaqGroup(id(req), req.body)),
  deleteFaqGroup: handle('deleteFaqGroup', (req) => ContentService.deleteFaqGroup(id(req))),

  // admin: legal
  adminListLegal: handle('adminListLegal', () => ContentService.listLegalDocuments()),
  adminGetLegal: handle('adminGetLegal', (req) => ContentService.getLegalDocumentById(id(req))),
  createLegal: handle('createLegal', (req) => ContentService.createLegalDocument(req.body)),
  updateLegal: handle('updateLegal', (req) => ContentService.updateLegalDocument(id(req), req.body)),
  deleteLegal: handle('deleteLegal', (req) => ContentService.deleteLegalDocument(id(req))),

  // admin: size charts
  adminListSizeCharts: handle('adminListSizeCharts', () => ContentService.listSizeCharts()),
  adminGetSizeChart: handle('adminGetSizeChart', (req) => ContentService.getSizeChartById(id(req))),
  createSizeChart: handle('createSizeChart', (req) => ContentService.createSizeChart(req.body)),
  updateSizeChart: handle('updateSizeChart', (req) => ContentService.updateSizeChart(id(req), req.body)),
  deleteSizeChart: handle('deleteSizeChart', (req) => ContentService.deleteSizeChart(id(req))),
};

export { handle };
export default ContentController;
