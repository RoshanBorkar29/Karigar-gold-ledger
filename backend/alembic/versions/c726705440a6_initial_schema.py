"""initial_schema

Revision ID: c726705440a6
Revises: 
Create Date: 2026-11-03 22:36:23.594997

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c726705440a6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'item_categories',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_item_categories')),
    )
    op.create_index(op.f('ix_item_categories_name'), 'item_categories', ['name'], unique=True)

    op.create_table(
        'karigars',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_karigars')),
    )
    op.create_index(op.f('ix_karigars_code'), 'karigars', ['code'], unique=True)

    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('issue_clerk', 'finance_head', name='user_role'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    op.create_table(
        'ai_readings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('kind', sa.Enum('scale', 'karat', name='ai_reading_kind'), nullable=False),
        sa.Column('image_path', sa.String(length=500), nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('ai_value_text', sa.String(length=50), nullable=False),
        sa.Column('ai_unit', sa.String(length=20), nullable=False),
        sa.Column('ai_confidence', sa.Integer(), nullable=True),
        sa.Column('ai_readable', sa.Boolean(), nullable=False),
        sa.Column('typed_value_text', sa.String(length=50), nullable=True),
        sa.Column('confirmed_value_text', sa.String(length=50), nullable=True),
        sa.Column('outcome', sa.Enum('pending', 'confirmed', 'mismatch_blocked', 'rejected', 'fallback_manual', name='ai_reading_outcome'), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_ai_readings_created_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_ai_readings')),
    )

    op.create_table(
        'jobs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('job_no', sa.String(length=100), nullable=False),
        sa.Column('karigar_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('wastage_bp', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('open', 'closed', name='job_status'), nullable=False),
        sa.Column('opened_on', sa.Date(), nullable=False),
        sa.Column('closed_on', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("(status = 'open' AND closed_on IS NULL) OR (status = 'closed' AND closed_on IS NOT NULL)", name='ck_jobs_closed_on_status'),
        sa.CheckConstraint('wastage_bp >= 0 AND wastage_bp <= 10000', name='ck_jobs_wastage_bp_range'),
        sa.ForeignKeyConstraint(['category_id'], ['item_categories.id'], name=op.f('fk_jobs_category_id_item_categories')),
        sa.ForeignKeyConstraint(['karigar_id'], ['karigars.id'], name=op.f('fk_jobs_karigar_id_karigars')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_jobs')),
    )
    op.create_index(op.f('ix_jobs_job_no'), 'jobs', ['job_no'], unique=True)
    op.create_index('ix_jobs_karigar_id_status', 'jobs', ['karigar_id', 'status'], unique=False)

    op.create_table(
        'karigar_category_wastages',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('karigar_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('wastage_bp', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('wastage_bp >= 0 AND wastage_bp <= 10000', name='ck_karigar_category_wastage_bp_range'),
        sa.ForeignKeyConstraint(['category_id'], ['item_categories.id'], name=op.f('fk_karigar_category_wastages_category_id_item_categories')),
        sa.ForeignKeyConstraint(['karigar_id'], ['karigars.id'], name=op.f('fk_karigar_category_wastages_karigar_id_karigars')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_karigar_category_wastages')),
        sa.UniqueConstraint('karigar_id', 'category_id', name='uq_karigar_category_wastage'),
    )

    op.create_table(
        'old_gold_purchases',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('bill_no', sa.String(length=100), nullable=False),
        sa.Column('gross_mg', sa.BigInteger(), nullable=False),
        sa.Column('tested_purity_bp', sa.Integer(), nullable=False),
        sa.Column('deduction_mg', sa.BigInteger(), nullable=False),
        sa.Column('fine_mg', sa.BigInteger(), nullable=False),
        sa.Column('rate_paise_per_g', sa.BigInteger(), nullable=False),
        sa.Column('value_paise', sa.BigInteger(), nullable=False),
        sa.Column('payment_mode', sa.Enum('cash', 'upi', 'bank_transfer', 'cheque', name='payment_mode'), nullable=False),
        sa.Column('pan', sa.String(length=20), nullable=True),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('deduction_mg >= 0 AND deduction_mg < gross_mg', name='ck_old_gold_deduction_range'),
        sa.CheckConstraint('fine_mg > 0 AND fine_mg <= gross_mg', name='ck_old_gold_fine_mg_range'),
        sa.CheckConstraint('gross_mg > 0', name='ck_old_gold_gross_mg_positive'),
        sa.CheckConstraint('rate_paise_per_g > 0', name='ck_old_gold_rate_positive'),
        sa.CheckConstraint('tested_purity_bp > 0 AND tested_purity_bp <= 10000', name='ck_old_gold_purity_range'),
        sa.CheckConstraint('value_paise >= 0', name='ck_old_gold_value_paise_non_negative'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_old_gold_purchases_created_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_old_gold_purchases')),
    )
    op.create_index(op.f('ix_old_gold_purchases_bill_no'), 'old_gold_purchases', ['bill_no'], unique=True)

    op.create_table(
        'vault_movements',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('kind', sa.Enum('bullion_in', 'to_refiner', 'from_refiner', name='vault_movement_kind'), nullable=False),
        sa.Column('fine_mg', sa.BigInteger(), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('fine_mg > 0', name='ck_vault_movements_fine_mg_positive'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_vault_movements_created_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_vault_movements')),
    )

    op.create_table(
        'issues',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('txn_id', sa.String(length=50), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('karigar_id', sa.Integer(), nullable=False),
        sa.Column('gross_mg', sa.BigInteger(), nullable=False),
        sa.Column('purity_bp', sa.Integer(), nullable=False),
        sa.Column('fine_mg', sa.BigInteger(), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('fine_mg > 0 AND fine_mg <= gross_mg', name='ck_issues_fine_mg_range'),
        sa.CheckConstraint('gross_mg > 0', name='ck_issues_gross_mg_positive'),
        sa.CheckConstraint('purity_bp > 0 AND purity_bp <= 10000', name='ck_issues_purity_bp_range'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_issues_created_by_users')),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], name=op.f('fk_issues_job_id_jobs')),
        sa.ForeignKeyConstraint(['karigar_id'], ['karigars.id'], name=op.f('fk_issues_karigar_id_karigars')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_issues')),
    )
    op.create_index('ix_issues_karigar_id_entry_date', 'issues', ['karigar_id', 'entry_date'], unique=False)
    op.create_index(op.f('ix_issues_txn_id'), 'issues', ['txn_id'], unique=True)

    op.create_table(
        'loss_alerts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('karigar_id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=True),
        sa.Column('recent_loss_bp', sa.Integer(), nullable=False),
        sa.Column('baseline_mean_bp', sa.Integer(), nullable=False),
        sa.Column('baseline_stddev_bp', sa.Integer(), nullable=False),
        sa.Column('sample_size', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('new', 'reviewed', 'dismissed', name='loss_alert_status'), nullable=False),
        sa.Column('explanation', sa.Text(), nullable=False),
        sa.Column('explanation_source', sa.Enum('llm', 'template', name='explanation_source'), nullable=False),
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], name=op.f('fk_loss_alerts_job_id_jobs')),
        sa.ForeignKeyConstraint(['karigar_id'], ['karigars.id'], name=op.f('fk_loss_alerts_karigar_id_karigars')),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], name=op.f('fk_loss_alerts_reviewed_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_loss_alerts')),
    )

    op.create_table(
        'receipts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('txn_id', sa.String(length=50), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('karigar_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.Enum('finished', 'scrap', 'filings', name='receipt_kind'), nullable=False),
        sa.Column('gross_mg', sa.BigInteger(), nullable=False),
        sa.Column('purity_bp', sa.Integer(), nullable=False),
        sa.Column('fine_mg', sa.BigInteger(), nullable=False),
        sa.Column('huid', sa.String(length=50), nullable=True),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("(kind = 'finished') OR (huid IS NULL)", name='ck_receipts_huid_finished_only'),
        sa.CheckConstraint('fine_mg > 0 AND fine_mg <= gross_mg', name='ck_receipts_fine_mg_range'),
        sa.CheckConstraint('gross_mg > 0', name='ck_receipts_gross_mg_positive'),
        sa.CheckConstraint('purity_bp > 0 AND purity_bp <= 10000', name='ck_receipts_purity_bp_range'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_receipts_created_by_users')),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], name=op.f('fk_receipts_job_id_jobs')),
        sa.ForeignKeyConstraint(['karigar_id'], ['karigars.id'], name=op.f('fk_receipts_karigar_id_karigars')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_receipts')),
    )
    op.create_index('ix_receipts_karigar_id_entry_date', 'receipts', ['karigar_id', 'entry_date'], unique=False)
    op.create_index(op.f('ix_receipts_txn_id'), 'receipts', ['txn_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_receipts_txn_id'), table_name='receipts')
    op.drop_index('ix_receipts_karigar_id_entry_date', table_name='receipts')
    op.drop_table('receipts')

    op.drop_table('loss_alerts')

    op.drop_index(op.f('ix_issues_txn_id'), table_name='issues')
    op.drop_index('ix_issues_karigar_id_entry_date', table_name='issues')
    op.drop_table('issues')

    op.drop_table('vault_movements')

    op.drop_index(op.f('ix_old_gold_purchases_bill_no'), table_name='old_gold_purchases')
    op.drop_table('old_gold_purchases')

    op.drop_table('karigar_category_wastages')

    op.drop_index('ix_jobs_karigar_id_status', table_name='jobs')
    op.drop_index(op.f('ix_jobs_job_no'), table_name='jobs')
    op.drop_table('jobs')

    op.drop_table('ai_readings')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')

    op.drop_index(op.f('ix_karigars_code'), table_name='karigars')
    op.drop_table('karigars')

    op.drop_index(op.f('ix_item_categories_name'), table_name='item_categories')
    op.drop_table('item_categories')

    # Explicitly drop enums for PostgreSQL
    sa.Enum(name='receipt_kind').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='loss_alert_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='explanation_source').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='vault_movement_kind').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='payment_mode').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='job_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='ai_reading_outcome').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='ai_reading_kind').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='user_role').drop(op.get_bind(), checkfirst=True)
