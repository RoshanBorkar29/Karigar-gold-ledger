"""entry_voids_and_txn_seq

Revision ID: e4a71b29df31
Revises: c726705440a6
Create Date: 2026-11-04 20:49:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4a71b29df31'
down_revision: Union[str, None] = 'c726705440a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create entry_voids table
    op.create_table(
        'entry_voids',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('issue_id', sa.Integer(), nullable=True),
        sa.Column('receipt_id', sa.Integer(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('voided_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            '((issue_id IS NOT NULL AND receipt_id IS NULL) OR (issue_id IS NULL AND receipt_id IS NOT NULL))',
            name='ck_entry_voids_target_exclusive'
        ),
        sa.CheckConstraint('length(reason) >= 5', name='ck_entry_voids_reason_length'),
        sa.ForeignKeyConstraint(['issue_id'], ['issues.id'], name=op.f('fk_entry_voids_issue_id_issues')),
        sa.ForeignKeyConstraint(['receipt_id'], ['receipts.id'], name=op.f('fk_entry_voids_receipt_id_receipts')),
        sa.ForeignKeyConstraint(['voided_by'], ['users.id'], name=op.f('fk_entry_voids_voided_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_entry_voids')),
        sa.UniqueConstraint('issue_id', name=op.f('uq_entry_voids_issue_id')),
        sa.UniqueConstraint('receipt_id', name=op.f('uq_entry_voids_receipt_id')),
    )

    # 2. Create txn_seq sequence starting at 30500
    op.execute(sa.schema.CreateSequence(sa.Sequence('txn_seq', start=30500)))


def downgrade() -> None:
    # 1. Drop sequence txn_seq
    op.execute(sa.schema.DropSequence(sa.Sequence('txn_seq')))

    # 2. Drop table entry_voids
    op.drop_table('entry_voids')
