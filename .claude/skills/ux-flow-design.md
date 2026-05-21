---
name: ux-flow-design
description: UX flow design patterns for web applications — user journeys, navigation flows, form UX, onboarding, loading/empty/error states, confirmation patterns, toast/notification systems, modal/dialog patterns, and responsive interaction design
---

# UX Flow Design

## User Journey Mapping

### Journey Structure

```
Every user journey has phases:

Awareness → Consideration → Action → Retention → Advocacy

For web apps, focus on the Action phase:
1. Entry     — How users arrive (direct, search, referral, deep link)
2. Discovery — Finding what they need (navigation, search, browse)
3. Action    — Core task (create, edit, delete, purchase, submit)
4. Feedback  — Result confirmation (success, error, pending)
5. Exit      — Where they go next (related content, dashboard, logout)

Map each phase to:
- User goal        — What they want to accomplish
- Screen(s)        — Which views are involved
- Actions          — What they click/type
- Data needed      — What info the system needs
- Error paths      — What can go wrong
- Success outcome  — What happens on completion
```

### Flow Diagram Template

```
[Entry Point]
     │
     ▼
[Landing / Dashboard]
     │
     ├──→ [Browse / List View] ──→ [Detail View] ──→ [Action]
     │                                                  │
     ├──→ [Search] ──→ [Results] ──→ [Detail View]     │
     │                                       │          │
     └──→ [Quick Action] ───────────────────┘          │
                                                        ▼
                                              [Confirmation Dialog]
                                                   │          │
                                              [Confirm]   [Cancel]
                                                   │          │
                                                   ▼          │
                                          [Processing/Loading]│
                                              │    │          │
                                         [Success] [Error]    │
                                              │       │       │
                                              ▼       ▼       │
                                         [Result View] ◄──────┘
```

## Navigation Flow Patterns

### App Shell Layout

```typescript
// Consistent shell with dynamic content area
const AppShell = (props: {
    sidebar?: VNode;
    header?: VNode;
    content: VNode;
    footer?: VNode;
}) => (
    <div class="app-shell">
        <header class="app-header">{props.header}</header>
        <div class="app-body">
            {props.sidebar && <aside class="app-sidebar">{props.sidebar}</aside>}
            <main class="app-content">{props.content}</main>
        </div>
        {props.footer && <footer class="app-footer">{props.footer}</footer>}
    </div>
);
```

### Breadcrumb Navigation

```typescript
interface BreadcrumbItem {
    label: string;
    path?: string; // undefined = current page (no link)
}

const Breadcrumbs = (items: BreadcrumbItem[]) => (
    <nav class="breadcrumbs" aria-label="Breadcrumb">
        <ol>
            {items.map((item, i) => (
                <li>
                    {item.path
                        ? routerLink(router, { to: item.path }, item.label)
                        : <span aria-current="page">{item.label}</span>
                    }
                    {i < items.length - 1 && <span class="separator">/</span>}
                </li>
            ))}
        </ol>
    </nav>
);

// Usage
<Breadcrumbs items={[
    { label: 'Home', path: '/' },
    { label: 'Products', path: '/products' },
    { label: 'Widget Pro' }, // current page
]} />
```

### Wizard / Stepper Flow

```typescript
interface Step {
    title: string;
    validate: () => boolean;
    render: () => VNode;
}

function createWizard(steps: Step[]) {
    const currentStep = createState(0);
    const isSubmitting = createState(false);

    const canGoNext = computed([currentStep], (step) => {
        return step < steps.length - 1 && steps[step].validate();
    });

    const canGoBack = computed([currentStep], (step) => step > 0);

    const isFirst = computed([currentStep], (step) => step === 0);
    const isLast = computed([currentStep], (step) => step === steps.length - 1);

    return {
        currentStep,
        canGoNext,
        canGoBack,
        isFirst,
        isLast,
        isSubmitting,
        next: () => {
            if (canGoNext.value) currentStep.value++;
        },
        back: () => {
            if (canGoBack.value) currentStep.value--;
        },
        goTo: (step: number) => {
            if (step >= 0 && step < steps.length) currentStep.value = step;
        },
        view: reactive(currentStep, (step) => (
            <div class="wizard">
                <div class="wizard-steps">
                    {steps.map((s, i) => (
                        <div class={['wizard-step', i === step && 'active', i < step && 'completed']}>
                            <span class="step-number">{i + 1}</span>
                            <span class="step-title">{s.title}</span>
                        </div>
                    ))}
                </div>
                <div class="wizard-content">
                    {steps[step].render()}
                </div>
                <div class="wizard-actions">
                    {!isFirst.value && (
                        <button class="btn-secondary" onclick={() => currentStep.value--}>Back</button>
                    )}
                    {isLast.value
                        ? <button class="btn-primary" onclick={() => { isSubmitting.value = true; }}>Submit</button>
                        : <button class="btn-primary" onclick={() => currentStep.value++} disabled={!canGoNext.value}>Next</button>
                    }
                </div>
            </div>
        )),
    };
}
```

## Form UX Patterns

### Multi-Field Form with Validation

```typescript
interface FormField {
    name: string;
    label: string;
    type: string;
    required?: boolean;
    validate?: (value: string) => string | null; // null = valid
}

function createForm<T extends Record<string, string>>(fields: FormField[]) {
    const values: Record<string, State<string>> = {};
    const errors: Record<string, State<string | null>> = {};
    const touched: Record<string, State<boolean>> = {};

    for (const field of fields) {
        values[field.name] = createState('');
        errors[field.name] = createState<string | null>(null);
        touched[field.name] = createState(false);
    }

    function validateField(name: string): boolean {
        const field = fields.find(f => f.name === name);
        if (!field) return true;

        const value = values[name].value;

        if (field.required && !value.trim()) {
            errors[name].value = `${field.label} is required`;
            return false;
        }

        if (field.validate) {
            const err = field.validate(value);
            errors[name].value = err;
            return err === null;
        }

        errors[name].value = null;
        return true;
    }

    function validateAll(): boolean {
        let valid = true;
        for (const field of fields) {
            touched[field.name].value = true;
            if (!validateField(field.name)) valid = false;
        }
        return valid;
    }

    const isSubmitting = createState(false);

    return {
        values,
        errors,
        touched,
        isSubmitting,
        validateField,
        validateAll,
        reset: () => {
            for (const field of fields) {
                values[field.name].value = '';
                errors[field.name].value = null;
                touched[field.name].value = false;
            }
        },
        view: (
            <form class="form" onsubmit={(e: Event) => { e.preventDefault(); }}>
                {fields.map(field => (
                    <div class={['form-field', errors[field.name].value && touched[field.name].value && 'has-error']}>
                        <label for={field.name}>{field.label}</label>
                        <input
                            id={field.name}
                            type={field.type}
                            {...bindValue(values[field.name])}
                            onblur={() => { touched[field.name].value = true; validateField(field.name); }}
                        />
                        {reactive(errors[field.name], (err) =>
                            err && touched[field.name].value
                                ? <span class="field-error">{err}</span>
                                : null
                        )}
                    </div>
                ))}
            </form>
        ),
    };
}
```

### Search with Results Flow

```typescript
function createSearchFlow<T>(options: {
    searchFn: (query: string) => Promise<T[]>;
    renderResult: (item: T) => VNode;
    debounceMs?: number;
    minQueryLength?: number;
}) {
    const query = createState('');
    const results = createState<T[]>([]);
    const status = createState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');
    const errorMessage = createState('');

    const minLen = options.minQueryLength ?? 2;
    let searchTimer: ReturnType<typeof setTimeout>;

    async function doSearch(q: string) {
        if (q.length < minLen) {
            results.value = [];
            status.value = 'idle';
            return;
        }

        status.value = 'loading';
        try {
            const data = await options.searchFn(q);
            results.value = data;
            status.value = data.length > 0 ? 'success' : 'empty';
        } catch (err) {
            status.value = 'error';
            errorMessage.value = (err as Error).message;
        }
    }

    query.subscribe((q) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => doSearch(q), options.debounceMs ?? 300);
    });

    return {
        query,
        results,
        status,
        errorMessage,
        view: (
            <div class="search-flow">
                <input
                    type="search"
                    class="search-input"
                    placeholder={`Search (min ${minLen} characters)...`}
                    {...bindValue(query)}
                />
                {reactive(status, (s) => {
                    switch (s) {
                        case 'loading': return <div class="search-loading">Searching...</div>;
                        case 'empty': return <div class="search-empty">No results found</div>;
                        case 'error': return <div class="search-error">{errorMessage.value}</div>;
                        case 'success': return null; // results rendered below
                        default: return null;
                    }
                })}
                {reactive(results, (items) => items.map(options.renderResult))}
            </div>
        ),
    };
}
```

## State Patterns (Loading / Empty / Error)

### Data Fetch Wrapper

```typescript
type FetchStatus = 'idle' | 'loading' | 'refreshing' | 'success' | 'empty' | 'error';

function createDataView<T>(options: {
    fetchFn: () => Promise<T[]>;
    renderList: (items: T[]) => VNode;
    renderEmpty?: () => VNode;
    renderError?: (message: string) => VNode;
}) {
    const data = createState<T[]>([]);
    const status = createState<FetchStatus>('idle');
    const error = createState('');

    async function refresh() {
        status.value = data.value.length > 0 ? 'refreshing' : 'loading';
        try {
            const result = await options.fetchFn();
            data.value = result;
            status.value = result.length > 0 ? 'success' : 'empty';
        } catch (err) {
            error.value = (err as Error).message;
            status.value = 'error';
        }
    }

    return {
        data,
        status,
        error,
        refresh,
        view: reactive(status, (s) => {
            switch (s) {
                case 'idle':
                case 'loading':
                    return <div class="data-loading">{SkeletonList()}</div>;
                case 'refreshing':
                    return (
                        <div class="data-refreshing">
                            {options.renderList(data.value)}
                            <div class="refresh-overlay" />
                        </div>
                    );
                case 'success':
                    return options.renderList(data.value);
                case 'empty':
                    return options.renderEmpty
                        ? options.renderEmpty()
                        : <EmptyState title="No data" description="Nothing to show yet" />;
                case 'error':
                    return options.renderError
                        ? options.renderError(error.value)
                        : <ErrorState message={error.value} onRetry={refresh} />;
            }
        }),
    };
}

const SkeletonList = () => (
    <div class="skeleton-list">
        {Array.from({ length: 5 }, (_, i) => (
            <div class="skeleton-item" style={`animation-delay: ${i * 0.1}s`}>
                <div class="skeleton-avatar" />
                <div class="skeleton-lines">
                    <div class="skeleton-line" style="width: 60%" />
                    <div class="skeleton-line" style="width: 40%" />
                </div>
            </div>
        ))}
    </div>
);
```

### Empty State Component

```typescript
interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: string;
    action?: { label: string; onClick: () => void };
}

const EmptyState = (props: EmptyStateProps) => (
    <div class="empty-state">
        {props.icon && <div class="empty-icon">{props.icon}</div>}
        <h3 class="empty-title">{props.title}</h3>
        {props.description && <p class="empty-desc">{props.description}</p>}
        {props.action && (
            <button class="btn-primary" onclick={props.action.onClick}>
                {props.action.label}
            </button>
        )}
    </div>
);

// Usage patterns
<EmptyState
    title="No products yet"
    description="Add your first product to get started"
    action={{ label: 'Add Product', onClick: () => navigate('/products/new') }}
/>

<EmptyState
    title="No search results"
    description="Try different keywords or filters"
/>

<EmptyState
    title="No notifications"
    description="You're all caught up!"
/>
```

### Error State Component

```typescript
interface ErrorStateProps {
    message: string;
    onRetry?: () => void;
    code?: number;
}

const ErrorState = (props: ErrorStateProps) => (
    <div class="error-state">
        <div class="error-icon">!</div>
        <h3 class="error-title">Something went wrong</h3>
        <p class="error-message">{props.message}</p>
        {props.onRetry && (
            <button class="btn-secondary" onclick={props.onRetry}>Try Again</button>
        )}
    </div>
);
```

## Confirmation & Feedback Patterns

### Confirmation Dialog

```typescript
interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
}

function createConfirmDialog() {
    const visible = createState(false);
    const options = createState<ConfirmOptions>({
        title: '',
        message: '',
    });
    let resolver: ((confirmed: boolean) => void) | null = null;

    function confirm(opts: ConfirmOptions): Promise<boolean> {
        options.value = { confirmLabel: 'Confirm', cancelLabel: 'Cancel', ...opts };
        visible.value = true;
        return new Promise((resolve) => { resolver = resolve; });
    }

    function handleConfirm() {
        visible.value = false;
        resolver?.(true);
        resolver = null;
    }

    function handleCancel() {
        visible.value = false;
        resolver?.(false);
        resolver = null;
    }

    return {
        confirm,
        view: reactive(visible, (show) =>
            show ? (
                <div class="modal-overlay" onclick={handleCancel}>
                    <div class="modal-dialog" role="dialog" aria-modal="true">
                        <h3>{options.value.title}</h3>
                        <p>{options.value.message}</p>
                        <div class="modal-actions">
                            <button class="btn-secondary" onclick={handleCancel}>
                                {options.value.cancelLabel}
                            </button>
                            <button
                                class={options.value.destructive ? 'btn-danger' : 'btn-primary'}
                                onclick={handleConfirm}
                            >
                                {options.value.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null
        ),
    };
}

// Usage
const dialog = createConfirmDialog();

async function deleteItem(id: string) {
    const confirmed = await dialog.confirm({
        title: 'Delete Item',
        message: 'Are you sure? This action cannot be undone.',
        confirmLabel: 'Delete',
        destructive: true,
    });

    if (confirmed) {
        await api.delete(`/items/${id}`);
        showToast('Item deleted');
    }
}
```

### Toast / Notification System

```typescript
interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration: number;
}

function createToastManager() {
    const toasts = createState<Toast[]>([]);

    function add(type: Toast['type'], message: string, duration = 4000) {
        const id = crypto.randomUUID();
        toasts.value = [...toasts.value, { id, type, message, duration }];

        setTimeout(() => {
            toasts.value = toasts.value.filter(t => t.id !== id);
        }, duration);
    }

    function dismiss(id: string) {
        toasts.value = toasts.value.filter(t => t.id !== id);
    }

    return {
        success: (msg: string) => add('success', msg),
        error: (msg: string) => add('error', msg, 8000),
        warning: (msg: string) => add('warning', msg),
        info: (msg: string) => add('info', msg),
        dismiss,
        view: reactive(toasts, (list) => (
            <div class="toast-container" role="status" aria-live="polite">
                {list.map(toast => (
                    <div class={['toast', `toast-${toast.type}`]}>
                        <span class="toast-message">{toast.message}</span>
                        <button class="toast-dismiss" onclick={() => dismiss(toast.id)}>×</button>
                    </div>
                ))}
            </div>
        )),
    };
}

const toast = createToastManager();

// Usage after actions
await createUser(data);
toast.success('User created successfully');

await submitForm(data);
toast.error('Failed to submit. Please try again.');
```

### Optimistic Update Pattern

```typescript
function createOptimisticUpdate<T>(options: {
    current: State<T[]>;
    mutate: (item: T) => Promise<T>;
    identityKey: keyof T;
}) {
    return async (newItem: T) => {
        // 1. Optimistic: add immediately
        options.current.value = [...options.current.value, newItem];

        try {
            // 2. Server call
            const saved = await options.mutate(newItem);

            // 3. Replace optimistic item with server response
            options.current.value = options.current.value.map(item =>
                item[options.identityKey] === newItem[options.identityKey] ? saved : item
            );

            toast.success('Saved');
        } catch (err) {
            // 4. Rollback on failure
            options.current.value = options.current.value.filter(
                item => item[options.identityKey] !== newItem[options.identityKey]
            );
            toast.error('Failed to save. Please try again.');
        }
    };
}
```

## Onboarding Flow

```typescript
function createOnboarding(steps: Array<{
    title: string;
    description: string;
    render: () => VNode;
}>) {
    const step = createState(0);
    const completed = createState(false);

    return {
        step,
        completed,
        view: reactive(step, (s) => {
            if (completed.value) {
                return (
                    <div class="onboarding-complete">
                        <h2>You're all set!</h2>
                        <button class="btn-primary" onclick={() => router.push('/dashboard')}>
                            Go to Dashboard
                        </button>
                    </div>
                );
            }

            const current = steps[s];
            return (
                <div class="onboarding">
                    <div class="onboarding-progress">
                        {steps.map((_, i) => (
                            <div class={['progress-dot', i <= s && 'completed']} />
                        ))}
                    </div>
                    <h2>{current.title}</h2>
                    <p>{current.description}</p>
                    <div class="onboarding-content">{current.render()}</div>
                    <div class="onboarding-actions">
                        {s > 0 && (
                            <button class="btn-secondary" onclick={() => step.value--}>Back</button>
                        )}
                        {s < steps.length - 1
                            ? <button class="btn-primary" onclick={() => step.value++}>Next</button>
                            : <button class="btn-primary" onclick={() => { completed.value = true; }}>Get Started</button>
                        }
                    </div>
                </div>
            );
        }),
    };
}
```

## Pull-to-Refresh & Infinite Scroll

### Infinite Scroll

```typescript
function createInfiniteScroll<T>(options: {
    fetchFn: (page: number) => Promise<{ data: T[]; hasMore: boolean }>;
    renderItem: (item: T) => VNode;
    pageSize?: number;
}) {
    const items = createState<T[]>([]);
    const page = createState(1);
    const hasMore = createState(true);
    const loading = createState(false);

    async function loadMore() {
        if (loading.value || !hasMore.value) return;

        loading.value = true;
        try {
            const result = await options.fetchFn(page.value);
            items.value = [...items.value, ...result.data];
            hasMore.value = result.hasMore;
            page.value++;
        } finally {
            loading.value = false;
        }
    }

    // Set up intersection observer for sentinel element
    setTimeout(() => {
        const sentinel = document.getElementById('scroll-sentinel');
        if (!sentinel) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) loadMore();
        }, { rootMargin: '400px' });

        observer.observe(sentinel);
    }, 100);

    return {
        items,
        loading,
        hasMore,
        refresh: () => {
            items.value = [];
            page.value = 1;
            hasMore.value = true;
            loadMore();
        },
        view: (
            <div class="infinite-scroll">
                {reactive(items, (list) => list.map(options.renderItem))}
                <div id="scroll-sentinel">
                    {reactive(loading, (isLoading) =>
                        isLoading ? <div class="loading-spinner">Loading more...</div> : null
                    )}
                </div>
            </div>
        ),
    };
}
```

## Responsive Flow Patterns

### Conditional Mobile/Desktop Layout

```typescript
const isMobile = createState(window.innerWidth < 768);

window.addEventListener('resize', debounce(() => {
    isMobile.value = window.innerWidth < 768;
}, 150));

// Adaptive layout
const layout = reactive(isMobile, (mobile) =>
    mobile
        ? <MobileLayout>{content}</MobileLayout>
        : <DesktopLayout>{content}</DesktopLayout>
);

// Mobile: bottom sheet actions
// Desktop: dropdown menu
const ActionsMenu = (actions: Action[]) => reactive(isMobile, (mobile) =>
    mobile
        ? <BottomSheet>{actions.map(a => <button onclick={a.onClick}>{a.label}</button>)}</BottomSheet>
        : <DropdownMenu>{actions.map(a => <button onclick={a.onClick}>{a.label}</button>)}</DropdownMenu>
);
```

## Code Style Rules

- Always show loading state while fetching data — never leave a blank screen.
- Always provide empty state with clear message and actionable next step.
- Always provide error state with retry mechanism — never just show an error code.
- Use optimistic updates for instant feedback on create/delete — rollback on failure.
- Confirm destructive actions (delete, discard, reset) with a dialog before executing.
- Show toast notifications for action results (success/failure) — auto-dismiss after 4 seconds.
- Use wizard/stepper for multi-step forms (3+ steps) — show progress indicator.
- Validate form fields on blur, not on every keystroke — validate all on submit.
- Debounce search input (200-300ms) — don't fire API call on every character.
- Use skeleton loaders that match the final layout shape — prevents CLS.
- Use breadcrumbs for deep navigation (3+ levels) — help users orient themselves.
- Support keyboard navigation — Tab, Enter, Escape should work on all interactive elements.
- Use infinite scroll for feed-like content, pagination for table-like content.
- Handle network offline gracefully — queue actions, show offline indicator, sync when back.
- Design empty states as call-to-action, not dead ends.
