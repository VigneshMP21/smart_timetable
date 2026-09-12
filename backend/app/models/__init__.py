"""
Purpose: Model Registry
Author: Smart Timetable Backend Team
Module Description: Importing this package registers every ORM model with the
shared declarative Base metadata. Any code path that imports a single model
module automatically gets the full schema, so foreign keys to "profiles" (and
every other table) always resolve at mapper configuration time.
"""

from app.models.class_model import Class
from app.models.constraint_model import Constraint
from app.models.faculty_model import Faculty
from app.models.profile_model import Profile
from app.models.room_model import Room
from app.models.setup_config_model import SetupConfig
from app.models.subject_model import Subject
from app.models.timetable_model import TimetableEntry
