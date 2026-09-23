"""Translation dictionaries for supported languages (English, Nepali)."""

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class Translation:
    """Single translation entry with English and Nepali."""
    key: str
    en: str
    ne: str


# Field labels
FIELD_LABELS = {
    "capacity_mw": Translation("capacity_mw", "Capacity (MW)", "क्षमता (मेगावाट)"),
    "power_output_mwh": Translation("power_output_mwh", "Power Output (MWh)", "विद्युत उत्पादन (मेगावाट घंटा)"),
    "project_name": Translation("project_name", "Project Name", "परियोजना नाम"),
    "project_id": Translation("project_id", "Project ID", "परियोजना आईडी"),
    "loan_account_id": Translation("loan_account_id", "Loan Account ID", "ऋण खाता आईडी"),
    "principal_amount": Translation("principal_amount", "Principal Amount", "मूल रकम"),
    "interest_rate": Translation("interest_rate", "Interest Rate", "ब्याज दर"),
    "loan_amount": Translation("loan_amount", "Loan Amount", "ऋण राशि"),
    "outstanding_balance": Translation("outstanding_balance", "Outstanding Balance", "बकाया शेष"),
    "disbursed_amount": Translation("disbursed_amount", "Disbursed Amount", "वितरित राशि"),
    "status": Translation("status", "Status", "स्थिति"),
    "created_at": Translation("created_at", "Created At", "निर्मित"),
    "updated_at": Translation("updated_at", "Updated At", "अद्यतन"),
    "maturity_date": Translation("maturity_date", "Maturity Date", "परिपक्वता मिति"),
    "currency": Translation("currency", "Currency", "मुद्रा"),
    "description": Translation("description", "Description", "विवरण"),
    "location": Translation("location", "Location", "स्थान"),
    "province": Translation("province", "Province", "प्रान्त"),
    "district": Translation("district", "District", "जिल्ला"),
}

# Enum values
STATUS_ENUMS = {
    "active": Translation("active", "Active", "सक्रिय"),
    "inactive": Translation("inactive", "Inactive", "निष्क्रिय"),
    "under_construction": Translation("under_construction", "Under Construction", "निर्माणाधीन"),
    "under_operation": Translation("under_operation", "Under Operation", "परिचालनमा"),
    "commissioned": Translation("commissioned", "Commissioned", "प्रचलन गरिएको"),
    "decommissioned": Translation("decommissioned", "Decommissioned", "अप्रचलन गरिएको"),
    "suspended": Translation("suspended", "Suspended", "स्थगित"),
    "on_hold": Translation("on_hold", "On Hold", "प्रतीक्षामा"),
}

LOAN_STATUS_ENUMS = {
    "active": Translation("active", "Active", "सक्रिय"),
    "disbursed": Translation("disbursed", "Disbursed", "वितरित"),
    "matured": Translation("matured", "Matured", "परिपक्व"),
    "in_arrears": Translation("in_arrears", "In Arrears", "तहसिलमा"),
    "restructured": Translation("restructured", "Restructured", "पुनर्निर्माण गरिएको"),
    "closed": Translation("closed", "Closed", "बन्द"),
}

ROLE_ENUMS = {
    "admin": Translation("admin", "Administrator", "प्रशासक"),
    "loan_officer": Translation("loan_officer", "Loan Officer", "ऋण अधिकृत"),
    "project_manager": Translation("project_manager", "Project Manager", "परियोजना प्रबन्धक"),
    "approver": Translation("approver", "Approver", "अनुमोदक"),
    "viewer": Translation("viewer", "Viewer", "दर्शक"),
}

# Error messages
ERROR_MESSAGES = {
    "unauthorized": Translation("unauthorized", "Unauthorized", "अनुमति दिइएको छैन"),
    "not_found": Translation("not_found", "Resource not found", "स्रोत फेला परेन"),
    "invalid_token": Translation("invalid_token", "Invalid or expired token", "अमान्य वा सिकस्त टोकन"),
    "invalid_credentials": Translation("invalid_credentials", "Invalid credentials", "अमान्य प्रमाण पत्र"),
    "missing_mfa": Translation("missing_mfa", "Multi-factor authentication required", "बहु-कारक प्रमाणीकरण आवश्यक"),
    "account_locked": Translation("account_locked", "Account locked", "खाता लक गरिएको"),
    "email_required": Translation("email_required", "Email is required", "ईमेल आवश्यक छ"),
    "password_required": Translation("password_required", "Password is required", "पासवर्ड आवश्यक छ"),
    "invalid_email": Translation("invalid_email", "Invalid email address", "अमान्य ईमेल पता"),
    "validation_error": Translation("validation_error", "Validation error", "प्रमाणीकरण त्रुटि"),
    "database_error": Translation("database_error", "Database error", "डेटाबेस त्रुटि"),
    "server_error": Translation("server_error", "Internal server error", "आंतरिक सर्भर त्रुटि"),
}

# UI labels
UI_LABELS = {
    "login": Translation("login", "Login", "लगइन"),
    "logout": Translation("logout", "Logout", "लगआउट"),
    "username": Translation("username", "Username", "प्रयोगकर्ताको नाम"),
    "password": Translation("password", "Password", "पासवर्ड"),
    "email": Translation("email", "Email", "ईमेल"),
    "submit": Translation("submit", "Submit", "जमा गर्नुहोस्"),
    "cancel": Translation("cancel", "Cancel", "रद्द गर्नुहोस्"),
    "save": Translation("save", "Save", "सुरक्षित गर्नुहोस्"),
    "delete": Translation("delete", "Delete", "मेटाउनुहोस्"),
    "edit": Translation("edit", "Edit", "सम्पादन गर्नुहोस्"),
    "add": Translation("add", "Add", "थप्नुहोस्"),
    "back": Translation("back", "Back", "फर्कनुहोस्"),
    "next": Translation("next", "Next", "अगलो"),
    "previous": Translation("previous", "Previous", "अघिल्लो"),
    "search": Translation("search", "Search", "खोज्नुहोस्"),
    "filter": Translation("filter", "Filter", "फिल्टर"),
    "download": Translation("download", "Download", "डाउनलोड गर्नुहोस्"),
    "export": Translation("export", "Export", "निर्यात गर्नुहोस्"),
    "import": Translation("import", "Import", "आयात गर्नुहोस्"),
    "settings": Translation("settings", "Settings", "सेटिङ्गहरू"),
    "profile": Translation("profile", "Profile", "प्रोफाइल"),
    "language": Translation("language", "Language", "भाषा"),
    "english": Translation("english", "English", "अङ्ग्रेजी"),
    "nepali": Translation("nepali", "Nepali", "नेपाली"),
}

# Covenant metrics
COVENANT_LABELS = {
    "dscr": Translation("dscr", "Debt Service Coverage Ratio", "ऋण सेवा कवरेज अनुपात"),
    "ltv": Translation("ltv", "Loan-to-Value Ratio", "ऋण-मूल्य अनुपात"),
    "icr": Translation("icr", "Interest Coverage Ratio", "ब्याज कवरेज अनुपात"),
    "dscr_min": Translation("dscr_min", "Minimum DSCR", "न्यूनतम डीएससीआर"),
    "dscr_actual": Translation("dscr_actual", "Actual DSCR", "वास्तविक डीएससीआर"),
    "ltv_max": Translation("ltv_max", "Maximum LTV", "अधिकतम एलटीवी"),
    "ltv_actual": Translation("ltv_actual", "Actual LTV", "वास्तविक एलटीवी"),
    "compliant": Translation("compliant", "Compliant", "अनुरूप"),
    "non_compliant": Translation("non_compliant", "Non-Compliant", "अनुरूप नभएको"),
}

# All translations combined
ALL_TRANSLATIONS = {
    **FIELD_LABELS,
    **STATUS_ENUMS,
    **LOAN_STATUS_ENUMS,
    **ROLE_ENUMS,
    **ERROR_MESSAGES,
    **UI_LABELS,
    **COVENANT_LABELS,
}


def get_translation(key: str, language: str = "en") -> str:
    """Get translation for a key.

    Args:
        key: Translation key (e.g., 'capacity_mw')
        language: Language code ('en' or 'ne')

    Returns:
        Translated string or original key if not found
    """
    if key not in ALL_TRANSLATIONS:
        return key

    translation = ALL_TRANSLATIONS[key]
    if language == "ne":
        return translation.ne
    return translation.en


def translate_dict(data: Dict, language: str = "en", keys_to_translate: Optional[set] = None) -> Dict:
    """Translate dictionary keys and enum values.

    Args:
        data: Dictionary to translate
        language: Language code ('en' or 'ne')
        keys_to_translate: Set of keys to translate (if None, translate all)

    Returns:
        Dictionary with translated keys and values
    """
    if not isinstance(data, dict):
        return data

    result = {}
    for key, value in data.items():
        # Translate key if needed
        translated_key = key
        if keys_to_translate is None or key in keys_to_translate:
            translated_key = get_translation(key, language)

        # Translate value if it's a string and looks like an enum
        translated_value = value
        if isinstance(value, str):
            translated_value = get_translation(value, language)
        elif isinstance(value, dict):
            translated_value = translate_dict(value, language, keys_to_translate)
        elif isinstance(value, list):
            translated_value = [
                translate_dict(item, language, keys_to_translate) if isinstance(item, dict)
                else get_translation(item, language) if isinstance(item, str) else item
                for item in value
            ]

        result[translated_key] = translated_value

    return result
