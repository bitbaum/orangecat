/**
 * OrangeCatClient — main entry point for @orangecat/sdk.
 *
 * Pattern: resource namespaces. Each entity gets its own object exposing
 * the methods supported in the current API version.
 *   v0.1: `.create()`
 *   v0.2: `.list()`
 *   v0.4: `.get(id)` — added here, matches the server's GET-by-id
 *         shipped in 94e99909.
 *
 * Usage (Loki, hirn.li, third parties):
 *
 *   import { OrangeCatClient } from '@orangecat/sdk';
 *
 *   const orangecat = new OrangeCatClient({
 *     apiKey: process.env.ORANGECAT_API_KEY!,
 *   });
 *
 *   const service = await orangecat.services.create({
 *     title: 'Claude Max',
 *     category: 'subscription',
 *     fixed_price: 0.001,
 *     currency: 'BTC',
 *   });
 */

import { HttpClient, type ClientOptions, type RequestOptions } from './http.js';
import type {
  CreateProductInput,
  ProductResponse,
  CreateServiceInput,
  ServiceResponse,
  CreateProjectInput,
  ProjectResponse,
  CreateCauseInput,
  CauseResponse,
  CreateEventInput,
  EventResponse,
  CreateLoanInput,
  LoanResponse,
  CreateInvestmentInput,
  InvestmentResponse,
  CreateAssetInput,
  AssetResponse,
  CreateWishlistInput,
  WishlistResponse,
  DiscoveryResponse,
  TimelinePublishInput,
  TimelinePublishResponse,
  CreateStakeholderInput,
  StakeholderListResponse,
  StakeholderCreateResponse,
} from './types.js';

const V1 = '/api/v1';

export interface ListParams {
  limit?: number;
  offset?: number;
  category?: string;
}

class EntityResource<Input, Response> {
  constructor(
    private readonly http: HttpClient,
    private readonly path: string
  ) {}

  create(input: Input, options?: RequestOptions): Promise<Response> {
    return this.http.post<Response>(this.path, input, options);
  }

  /**
   * List entities. With an integration key, results are scoped to the
   * actor the key is bound to (the only set of rows the key is allowed
   * to see). With session auth, returns the caller's rows.
   */
  list(params?: ListParams, options?: RequestOptions): Promise<Response[]> {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) {
      query.set('limit', String(params.limit));
    }
    if (params?.offset !== undefined) {
      query.set('offset', String(params.offset));
    }
    if (params?.category) {
      query.set('category', params.category);
    }
    const suffix = query.toString();
    const path = suffix ? `${this.path}?${suffix}` : this.path;
    return this.http.get<Response[]>(path, options);
  }

  /**
   * Get one entity by id. Returns the entity row; throws an
   * OrangeCatError with code `not_found` if the id doesn't exist OR
   * isn't visible to the caller — both surface as the same envelope
   * server-side so probers can't distinguish (see docs §6 in
   * docs/api/CONVENTIONS.md).
   */
  get(id: string, options?: RequestOptions): Promise<Response> {
    return this.http.get<Response>(`${this.path}/${encodeURIComponent(id)}`, options);
  }
}

class TimelineResource {
  constructor(private readonly http: HttpClient) {}

  publish(input: TimelinePublishInput, options?: RequestOptions): Promise<TimelinePublishResponse> {
    return this.http.post<TimelinePublishResponse>(`${V1}/timeline/publish`, input, options);
  }
}

export interface StakeholderListParams {
  fromProjectId: string;
  kind?: string;
}

class StakeholdersResource {
  constructor(private readonly http: HttpClient) {}

  list(params: StakeholderListParams, options?: RequestOptions): Promise<StakeholderListResponse> {
    const query = new URLSearchParams({ fromProjectId: params.fromProjectId });
    if (params.kind) {
      query.set('kind', params.kind);
    }
    return this.http.get<StakeholderListResponse>(`${V1}/stakeholders?${query}`, options);
  }

  create(
    input: CreateStakeholderInput,
    options?: RequestOptions
  ): Promise<StakeholderCreateResponse> {
    return this.http.post<StakeholderCreateResponse>(`${V1}/stakeholders`, input, options);
  }
}

export class OrangeCatClient {
  private readonly http: HttpClient;

  readonly products: EntityResource<CreateProductInput, ProductResponse>;
  readonly services: EntityResource<CreateServiceInput, ServiceResponse>;
  readonly projects: EntityResource<CreateProjectInput, ProjectResponse>;
  readonly causes: EntityResource<CreateCauseInput, CauseResponse>;
  readonly events: EntityResource<CreateEventInput, EventResponse>;
  readonly loans: EntityResource<CreateLoanInput, LoanResponse>;
  readonly investments: EntityResource<CreateInvestmentInput, InvestmentResponse>;
  readonly assets: EntityResource<CreateAssetInput, AssetResponse>;
  readonly wishlists: EntityResource<CreateWishlistInput, WishlistResponse>;
  readonly timeline: TimelineResource;
  readonly stakeholders: StakeholdersResource;

  constructor(options: ClientOptions) {
    this.http = new HttpClient(options);
    this.products = new EntityResource(this.http, `${V1}/products`);
    this.services = new EntityResource(this.http, `${V1}/services`);
    this.projects = new EntityResource(this.http, `${V1}/projects`);
    this.causes = new EntityResource(this.http, `${V1}/causes`);
    this.events = new EntityResource(this.http, `${V1}/events`);
    this.loans = new EntityResource(this.http, `${V1}/loans`);
    this.investments = new EntityResource(this.http, `${V1}/investments`);
    this.assets = new EntityResource(this.http, `${V1}/assets`);
    this.wishlists = new EntityResource(this.http, `${V1}/wishlists`);
    this.timeline = new TimelineResource(this.http);
    this.stakeholders = new StakeholdersResource(this.http);
  }

  /**
   * Confirm the server speaks v1 of the contract — SDK consumers should
   * call this once at startup and fail fast if the server is on a
   * different major version (suggesting they should upgrade the SDK).
   */
  discovery(options?: RequestOptions): Promise<DiscoveryResponse> {
    return this.http.get<DiscoveryResponse>(V1, options);
  }
}
