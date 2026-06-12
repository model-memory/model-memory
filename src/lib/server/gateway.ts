// Typed surface of the llm-gateway Worker's RPC entrypoint, reached via the
// LLM_GATEWAY service binding. These shapes mirror llm-gateway/src/types.ts;
// they are declared structurally here so this repo builds without the
// gateway checked out alongside it.

export type RunStatus = 'running' | 'completed' | 'failed';

export type RunSummary = {
	id: string;
	prompt: string;
	status: RunStatus;
	model_count: number;
	question_id: string | null;
	created_at: number;
	completed_at: number | null;
};

export type ResponseRow = {
	run_id: string;
	model: string;
	provider: string;
	response_text: string | null;
	latency_ms: number | null;
	error: string | null;
	recommended_product: string | null;
	created_at: number;
};

export type QuestionRow = {
	id: string;
	text: string;
	active: number;
	weekly: number;
	created_at: number;
};

export type RunDetail = {
	run: RunSummary;
	responses: ResponseRow[];
	workflow_status: unknown;
};

export type PaymentAllocation = 'all' | 'subset' | 'single';

export type PaymentRow = {
	id: string;
	payer: string | null;
	network: string | null;
	transaction_ref: string | null;
	amount_usdc_micro: number;
	credits: number;
	credits_remaining: number;
	allocation: PaymentAllocation;
	created_at: number;
};

export type QuestionBalance = {
	question_id: string;
	available_credits: number;
};

export type BalanceSummary = {
	global_credits: number;
	questions: QuestionBalance[];
};

export type RefreshResult = {
	run: RunSummary;
	payment_id: string;
	credits_remaining: number;
};

export type QuestionHistoryPick = {
	run_id: string;
	model: string;
	provider: string;
	recommended_product: string | null;
	error: string | null;
};

export type QuestionHistoryRun = {
	run: RunSummary;
	picks: QuestionHistoryPick[];
};

export type QuestionHistory = {
	question: QuestionRow;
	runs: QuestionHistoryRun[];
	funders: string[];
};

export interface LlmGateway {
	createRun(prompt: string, options?: { questionId?: string }): Promise<RunSummary>;
	getRun(runId: string): Promise<RunDetail>;
	listRuns(options?: {
		limit?: number;
		offset?: number;
		questionId?: string;
	}): Promise<RunSummary[]>;
	getQuestion(questionId: string): Promise<QuestionRow | null>;
	listQuestions(includeInactive?: boolean): Promise<QuestionRow[]>;
	addQuestion(text: string): Promise<QuestionRow>;
	setQuestionActive(questionId: string, active: boolean): Promise<void>;
	setQuestionWeekly(questionId: string, weekly: boolean): Promise<void>;
	recordPayment(input: {
		payer?: string;
		network?: string;
		transactionRef?: string;
		amountUsdcMicro: number;
		credits: number;
		allocation: PaymentAllocation;
		questionIds?: string[];
	}): Promise<PaymentRow>;
	refreshQuestion(questionId: string): Promise<RefreshResult>;
	getQuestionHistory(questionId: string, limit?: number): Promise<QuestionHistory>;
	getBalances(): Promise<BalanceSummary>;
}

// The generated Env types the service binding as Fetcher; the RPC methods
// exist at runtime on the WorkerEntrypoint stub.
export function gateway(platform: App.Platform | undefined): LlmGateway | null {
	const binding = platform?.env?.LLM_GATEWAY;
	return binding ? (binding as unknown as LlmGateway) : null;
}
