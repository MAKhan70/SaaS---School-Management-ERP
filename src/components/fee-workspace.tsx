"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type LedgerItem = {
  id: string;
  studentProfileId: string;
  description: string;
  amountMinor: number;
  outstandingMinor: number;
  dueOn: string;
  feeHead: { name: string; kind: string };
  studentProfile: {
    studentNumber: string;
    person: { firstName: string; lastName: string };
  };
};
type Workspace = {
  currency: "INR";
  categories: Array<{
    id: string;
    code: string;
    name: string;
    heads: Array<{ id: string; name: string; kind: string }>;
  }>;
  structures: Array<{
    id: string;
    name: string;
    version: number;
    gradeClass: { name: string };
    installments: Array<{ id: string; name: string; dueOn: string }>;
  }>;
  grades: Array<{ id: string; name: string }>;
  sections: Array<{ id: string; name: string; gradeClass: { name: string } }>;
  ledger: LedgerItem[];
  payments: Array<{
    id: string;
    amountMinor: number;
    method: string;
    state: string;
    paidAt: string;
    receipt?: { receiptNumber: string; finalizedAt: string } | null;
    reversal?: { id: string } | null;
  }>;
  pendingAdjustments: Array<{
    id: string;
    kind: string;
    amountMinor: number;
    reason: string;
    assignment: {
      feeHead: { name: string };
      studentProfile: {
        studentNumber: string;
        person: { firstName: string; lastName: string };
      };
    };
  }>;
  pendingRefunds: Array<{
    id: string;
    amountMinor: number;
    reason: string;
    payment: {
      receipt?: { receiptNumber: string } | null;
      studentProfile: {
        studentNumber: string;
        person: { firstName: string; lastName: string };
      };
    };
  }>;
  closures: Array<{ id: string; collectionDate: string; netMinor: number }>;
  reports: {
    outstandingMinor: number;
    collectionsMinor: number;
    collectionsByMethod: Array<{ method: string; amountMinor: number }>;
  };
};
type Tab =
  | "ledger"
  | "collect"
  | "configuration"
  | "reports"
  | "approvals"
  | "reconciliation";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});
function formatMoney(minor: number) {
  return inr.format(minor / 100);
}
function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function FeeWorkspace() {
  const [data, setData] = useState<Workspace>();
  const [tab, setTab] = useState<Tab>("ledger");
  const [studentProfileId, setStudentProfileId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (studentId: string) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams(
        studentId ? { studentProfileId: studentId } : {},
      );
      const response = await fetch(`/api/v1/fees?${query}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as Workspace & { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Fee data could not be loaded.");
      setData(result);
      setSelectedAssignmentId(
        (current) =>
          current ||
          result.ledger.find((item) => item.outstandingMinor > 0)?.id ||
          "",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Fee data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  async function mutate(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/v1/fees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        receipt?: { receiptNumber: string };
      };
      if (!response.ok)
        throw new Error(
          result.error ?? "Fee operation could not be completed.",
        );
      setMessage(
        result.receipt
          ? `Payment posted. Receipt ${result.receipt.receiptNumber}.`
          : "Saved successfully.",
      );
      await load(studentProfileId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Fee operation could not be completed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "category.create",
      code: value(form, "code").toUpperCase(),
      name: value(form, "name"),
    });
    event.currentTarget.reset();
  }

  async function submitHead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "head.create",
      categoryId: value(form, "categoryId"),
      code: value(form, "code").toUpperCase(),
      name: value(form, "name"),
      kind: value(form, "kind"),
      refundable: form.get("refundable") === "on",
    });
    event.currentTarget.reset();
  }

  async function submitStructure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const structureCode = value(form, "code").toUpperCase();
    await mutate({
      action: "structure.create",
      gradeClassId: value(form, "gradeClassId"),
      code: structureCode,
      name: value(form, "name"),
      version: 1,
      installments: [
        {
          code: "INSTALLMENT_1",
          name: value(form, "installmentName"),
          dueOn: value(form, "dueOn"),
          lines: [
            {
              feeHeadId: value(form, "feeHeadId"),
              amount: value(form, "amount"),
            },
          ],
        },
      ],
    });
  }

  async function applyClassStructure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "assignment.class.apply",
      feeStructureId: value(form, "feeStructureId"),
      sectionId: value(form, "sectionId"),
    });
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const assignment = data?.ledger.find(
      (item) => item.id === value(form, "assignmentId"),
    );
    if (!assignment) {
      setError("Select a fee assignment.");
      return;
    }
    await mutate({
      action: "payment.post",
      studentProfileId: assignment.studentProfileId,
      idempotencyKey: crypto.randomUUID(),
      method: value(form, "method"),
      amount: value(form, "amount"),
      paidAt: new Date().toISOString(),
      instrumentReference: value(form, "reference") || undefined,
      allocations: [
        { assignmentId: assignment.id, amount: value(form, "amount") },
      ],
    });
  }

  async function requestConcession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "adjustment.request",
      assignmentId: value(form, "assignmentId"),
      kind: value(form, "kind"),
      amount: value(form, "amount"),
      reason: value(form, "reason"),
    });
  }

  async function reversePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "payment.reverse",
      paymentId: value(form, "paymentId"),
      reason: value(form, "reason"),
    });
  }

  async function requestRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "refund.request",
      paymentId: value(form, "paymentId"),
      amount: value(form, "amount"),
      reason: value(form, "reason"),
    });
  }

  if (loading && !data)
    return (
      <div className="fee-state" role="status">
        Loading fee workspace…
      </div>
    );

  return (
    <section className="fee-workspace" aria-labelledby="fee-title">
      <header className="fee-heading">
        <div>
          <p className="eyebrow">Finance</p>
          <h1 id="fee-title">School fee management</h1>
          <p>
            Configure fees, maintain student ledgers, post payments and review
            immutable financial records.
          </p>
        </div>
        <strong>
          {formatMoney(data?.reports.outstandingMinor ?? 0)} outstanding
        </strong>
      </header>
      <nav className="fee-tabs" aria-label="Fee workspace sections">
        {(
          [
            "ledger",
            "collect",
            "configuration",
            "reports",
            "approvals",
            "reconciliation",
          ] as const
        ).map((item) => (
          <button
            key={item}
            type="button"
            aria-current={tab === item ? "page" : undefined}
            onClick={() => setTab(item)}
          >
            {item === "collect"
              ? "Collect payment"
              : item[0]?.toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="fee-success" role="status">
          {message}
        </div>
      )}

      {tab === "ledger" && (
        <div className="fee-panel-grid">
          <article className="fee-panel">
            <h2>Student fee ledger</h2>
            <form
              className="fee-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void load(studentProfileId);
              }}
            >
              <label>
                Student profile ID
                <input
                  name="studentProfileId"
                  value={studentProfileId}
                  onChange={(event) => setStudentProfileId(event.target.value)}
                  placeholder="Search by permitted student profile ID"
                />
              </label>
              <button disabled={loading}>Search</button>
            </form>
            {!data?.ledger.length ? (
              <p className="empty-state">
                No fee assignments are available in this scope.
              </p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Fee head</th>
                      <th>Due</th>
                      <th>Charge</th>
                      <th>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ledger.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.studentProfile.person.firstName}{" "}
                          {item.studentProfile.person.lastName}
                          <small>{item.studentProfile.studentNumber}</small>
                        </td>
                        <td>
                          {item.feeHead.name}
                          <small>{item.description}</small>
                        </td>
                        <td>
                          {new Date(item.dueOn).toLocaleDateString("en-IN")}
                        </td>
                        <td>{formatMoney(item.amountMinor)}</td>
                        <td>
                          <strong>{formatMoney(item.outstandingMinor)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
          <article className="fee-panel">
            <h2>Finalized receipts</h2>
            {!data?.payments.length ? (
              <p className="empty-state">No payments have been posted.</p>
            ) : (
              <ul className="receipt-list">
                {data.payments.map((payment) => (
                  <li key={payment.id}>
                    <div>
                      <strong>
                        {payment.receipt?.receiptNumber ?? "Receipt pending"}
                      </strong>
                      <span>
                        {payment.method.replaceAll("_", " ")} ·{" "}
                        {new Date(payment.paidAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <strong>{formatMoney(payment.amountMinor)}</strong>
                    <span
                      className={`status-pill ${payment.state === "REVERSED" ? "danger" : ""}`}
                    >
                      {payment.state}
                    </span>
                    {payment.state === "POSTED" && (
                      <details className="receipt-actions">
                        <summary>Correction actions</summary>
                        <form className="fee-form" onSubmit={reversePayment}>
                          <input
                            type="hidden"
                            name="paymentId"
                            value={payment.id}
                          />
                          <label>
                            Reversal reason
                            <input name="reason" minLength={5} required />
                          </label>
                          <button className="secondary" disabled={saving}>
                            Reverse payment
                          </button>
                        </form>
                        <form className="fee-form" onSubmit={requestRefund}>
                          <input
                            type="hidden"
                            name="paymentId"
                            value={payment.id}
                          />
                          <label>
                            Refund amount (INR)
                            <input name="amount" inputMode="decimal" required />
                          </label>
                          <label>
                            Refund reason
                            <input name="reason" minLength={5} required />
                          </label>
                          <button className="secondary" disabled={saving}>
                            Request refund
                          </button>
                        </form>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      )}

      {tab === "collect" && (
        <article className="fee-panel compact-panel">
          <h2>Collect a payment</h2>
          <p>
            Only opaque processor references are stored for card and online
            payments. Card details are never collected.
          </p>
          <form className="fee-form" onSubmit={submitPayment}>
            <fieldset>
              <legend>Payment allocation</legend>
              <label>
                Fee assignment
                <select
                  name="assignmentId"
                  required
                  value={selectedAssignmentId}
                  onChange={(event) =>
                    setSelectedAssignmentId(event.target.value)
                  }
                >
                  <option value="">Select outstanding fee</option>
                  {data?.ledger
                    .filter((item) => item.outstandingMinor > 0)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.studentProfile.studentNumber} —{" "}
                        {item.feeHead.name} —{" "}
                        {formatMoney(item.outstandingMinor)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Amount (INR)
                <input
                  name="amount"
                  inputMode="decimal"
                  pattern="^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$"
                  required
                />
              </label>
              <label>
                Payment method
                <select name="method" required>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card via simulated provider</option>
                  <option value="ONLINE_GATEWAY">
                    Online gateway (simulated)
                  </option>
                </select>
              </label>
              <label>
                Cheque / bank / UPI reference
                <input name="reference" maxLength={120} autoComplete="off" />
              </label>
            </fieldset>
            <button disabled={saving}>
              {saving ? "Posting…" : "Post exact payment and issue receipt"}
            </button>
          </form>
        </article>
      )}

      {tab === "configuration" && (
        <div className="fee-panel-grid">
          <article className="fee-panel">
            <h2>Fee categories</h2>
            <form className="fee-form" onSubmit={submitCategory}>
              <label>
                Category code
                <input
                  name="code"
                  pattern="[A-Za-z][A-Za-z0-9_-]{1,39}"
                  required
                />
              </label>
              <label>
                Category name
                <input name="name" required minLength={2} />
              </label>
              <button disabled={saving}>Create category</button>
            </form>
            <ul className="simple-list">
              {data?.categories.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <span>{item.code}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="fee-panel">
            <h2>Fee heads</h2>
            <form className="fee-form" onSubmit={submitHead}>
              <label>
                Category
                <select name="categoryId" required>
                  <option value="">Select category</option>
                  {data?.categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Head code
                <input
                  name="code"
                  pattern="[A-Za-z][A-Za-z0-9_-]{1,39}"
                  required
                />
              </label>
              <label>
                Head name
                <input name="name" required />
              </label>
              <label>
                Type
                <select name="kind">
                  <option value="REGULAR">Regular</option>
                  <option value="OPTIONAL">Optional</option>
                  <option value="TRANSPORT">Transport</option>
                  <option value="HOSTEL">Hostel</option>
                  <option value="LATE_FEE">Late fee</option>
                  <option value="FINE">Fine</option>
                </select>
              </label>
              <label className="checkbox-field">
                <input type="checkbox" name="refundable" /> Refundable
              </label>
              <button disabled={saving}>Create fee head</button>
            </form>
          </article>
          <article className="fee-panel full-span">
            <h2>Versioned fee structures</h2>
            <form
              className="fee-form fee-structure-form"
              onSubmit={submitStructure}
            >
              <label>
                Grade or class
                <select name="gradeClassId" required>
                  <option value="">Select grade</option>
                  {data?.grades.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Structure code
                <input
                  name="code"
                  pattern="[A-Za-z][A-Za-z0-9_-]{1,39}"
                  required
                />
              </label>
              <label>
                Structure name
                <input name="name" minLength={2} required />
              </label>
              <label>
                First installment
                <input name="installmentName" minLength={2} required />
              </label>
              <label>
                Due date
                <input name="dueOn" type="date" required />
              </label>
              <label>
                Fee head
                <select name="feeHeadId" required>
                  <option value="">Select fee head</option>
                  {data?.categories
                    .flatMap((category) => category.heads)
                    .map((head) => (
                      <option key={head.id} value={head.id}>
                        {head.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Amount (INR)
                <input name="amount" inputMode="decimal" required />
              </label>
              <button disabled={saving}>Create version 1 structure</button>
            </form>
            {!data?.structures.length ? (
              <p className="empty-state">
                No structures are configured for this academic year.
              </p>
            ) : (
              <ul className="simple-list">
                {data.structures.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.gradeClass.name} · Version {item.version}
                      </span>
                    </div>
                    <span>{item.installments.length} installments</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="fee-panel full-span">
            <h2>Class-level assignment</h2>
            <p>
              Apply every required line in a versioned fee structure to active
              enrollments. Existing line assignments are skipped safely.
            </p>
            <form
              className="fee-form fee-structure-form"
              onSubmit={applyClassStructure}
            >
              <label>
                Fee structure
                <select name="feeStructureId" required>
                  <option value="">Select structure</option>
                  {data?.structures.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.gradeClass.name} — {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <select name="sectionId" required>
                  <option value="">Select section</option>
                  {data?.sections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.gradeClass.name} — {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={saving}>Apply structure to class</button>
            </form>
          </article>
        </div>
      )}

      {tab === "reports" && (
        <div className="fee-panel-grid">
          <article className="fee-metric">
            <span>Total outstanding</span>
            <strong>{formatMoney(data?.reports.outstandingMinor ?? 0)}</strong>
          </article>
          <article className="fee-metric">
            <span>Posted collections</span>
            <strong>{formatMoney(data?.reports.collectionsMinor ?? 0)}</strong>
          </article>
          <article className="fee-panel full-span">
            <h2>Collection by payment method</h2>
            <ul className="simple-list">
              {data?.reports.collectionsByMethod.map((item) => (
                <li key={item.method}>
                  <span>{item.method.replaceAll("_", " ")}</span>
                  <strong>{formatMoney(item.amountMinor)}</strong>
                </li>
              ))}
            </ul>
          </article>
        </div>
      )}

      {tab === "approvals" && (
        <div className="fee-panel-grid">
          <article className="fee-panel">
            <h2>Concession and waiver request</h2>
            <form className="fee-form" onSubmit={requestConcession}>
              <label>
                Fee assignment
                <select name="assignmentId" required>
                  <option value="">Select fee</option>
                  {data?.ledger.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.studentProfile.studentNumber} — {item.feeHead.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Adjustment type
                <select name="kind">
                  <option value="CONCESSION">Concession</option>
                  <option value="SCHOLARSHIP">Scholarship</option>
                  <option value="WAIVER">Waiver</option>
                  <option value="DISCOUNT">Discount</option>
                  <option value="CREDIT_NOTE">Credit note</option>
                </select>
              </label>
              <label>
                Amount (INR)
                <input name="amount" inputMode="decimal" required />
              </label>
              <label>
                Reason
                <textarea name="reason" minLength={5} required />
              </label>
              <button disabled={saving}>Submit for independent approval</button>
            </form>
          </article>
          <article className="fee-panel">
            <h2>Approval queue</h2>
            {!data?.pendingAdjustments.length ? (
              <p className="empty-state">No adjustments await approval.</p>
            ) : (
              <ul className="approval-list">
                {data.pendingAdjustments.map((item) => (
                  <li key={item.id}>
                    <strong>
                      {item.assignment.studentProfile.person.firstName}{" "}
                      {item.assignment.studentProfile.person.lastName}
                    </strong>
                    <span>
                      {item.kind} · {item.assignment.feeHead.name} ·{" "}
                      {formatMoney(item.amountMinor)}
                    </span>
                    <p>{item.reason}</p>
                    <div>
                      <button
                        disabled={saving}
                        onClick={() =>
                          void mutate({
                            action: "adjustment.decide",
                            adjustmentId: item.id,
                            approve: true,
                            note: "Approved after supporting document review",
                          })
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="secondary"
                        disabled={saving}
                        onClick={() =>
                          void mutate({
                            action: "adjustment.decide",
                            adjustmentId: item.id,
                            approve: false,
                            note: "Rejected after supporting document review",
                          })
                        }
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <h3>Refund requests</h3>
            {!data?.pendingRefunds.length ? (
              <p className="empty-state">No refunds await approval.</p>
            ) : (
              <ul className="approval-list">
                {data.pendingRefunds.map((item) => (
                  <li key={item.id}>
                    <strong>
                      {item.payment.studentProfile.person.firstName}{" "}
                      {item.payment.studentProfile.person.lastName}
                    </strong>
                    <span>
                      {item.payment.receipt?.receiptNumber ?? "Payment"} ·{" "}
                      {formatMoney(item.amountMinor)}
                    </span>
                    <p>{item.reason}</p>
                    <div>
                      <button
                        disabled={saving}
                        onClick={() =>
                          void mutate({
                            action: "refund.decide",
                            refundId: item.id,
                            approve: true,
                            note: "Approved after refund evidence review",
                          })
                        }
                      >
                        Approve refund
                      </button>
                      <button
                        className="secondary"
                        disabled={saving}
                        onClick={() =>
                          void mutate({
                            action: "refund.decide",
                            refundId: item.id,
                            approve: false,
                            note: "Rejected after refund evidence review",
                          })
                        }
                      >
                        Reject refund
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      )}

      {tab === "reconciliation" && (
        <div className="fee-panel-grid">
          <article className="fee-panel">
            <h2>Gateway reconciliation</h2>
            <p>
              The local simulated provider accepts opaque event and payment
              references. Repeated events reconcile idempotently.
            </p>
            <form
              className="fee-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void mutate({
                  action: "gateway.reconcile",
                  providerEventId: value(form, "eventId"),
                  providerPaymentId: value(form, "paymentId"),
                  eventType: value(form, "eventType"),
                });
              }}
            >
              <label>
                Provider event ID
                <input name="eventId" required minLength={4} />
              </label>
              <label>
                Provider payment ID
                <input name="paymentId" required minLength={4} />
              </label>
              <label>
                Event type
                <select name="eventType">
                  <option value="PAYMENT_CONFIRMED">Payment confirmed</option>
                  <option value="PAYMENT_FAILED">Payment failed</option>
                  <option value="REFUND_CONFIRMED">Refund confirmed</option>
                </select>
              </label>
              <button disabled={saving}>Reconcile event</button>
            </form>
          </article>
          <article className="fee-panel">
            <h2>Daily collection closure</h2>
            <form
              className="fee-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void mutate({
                  action: "collection.close",
                  campusId: value(form, "campusId"),
                  date: value(form, "date"),
                });
              }}
            >
              <label>
                Campus ID
                <input name="campusId" required />
              </label>
              <label>
                Collection date
                <input name="date" type="date" required />
              </label>
              <button disabled={saving}>Close and snapshot collection</button>
            </form>
            <ul className="simple-list">
              {data?.closures.map((item) => (
                <li key={item.id}>
                  <span>
                    {new Date(item.collectionDate).toLocaleDateString("en-IN")}
                  </span>
                  <strong>{formatMoney(item.netMinor)}</strong>
                </li>
              ))}
            </ul>
          </article>
        </div>
      )}
    </section>
  );
}
