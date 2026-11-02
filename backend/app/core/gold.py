"""Exact fine-gold arithmetic using integer milligrams and purity basis points with half-up rounding.

Formula: fine_weight_mg = (gross_mg * purity_bp + 5000) // 10000. Floats are strictly prohibited.
"""
