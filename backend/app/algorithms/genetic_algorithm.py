"""
Purpose: Genetic Algorithm Optimizer
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Implements an evolutionary search algorithm to optimize soft constraints (idle gaps, workloads).
"""

from typing import Dict, Any, List, Tuple
import random
import copy
from app.utils.logger import get_logger
from app.services.conflict_checker import ConflictChecker

logger = get_logger(__name__)


class GeneticOptimizer:
    """
    Stochastically optimizes the timetable using mutation and crossover operators.
    """

    @classmethod
    def optimize(
        cls,
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        faculty_avail_map: Dict[str, str],
        constraints: Dict[str, Any],
        population_size: int = 10,
        generations: int = 15
    ) -> Dict[str, Dict[str, Dict[int, Dict[str, Any]]]]:
        """
        Runs genetic optimization on the provided schedule.

        Args:
            schedule (Dict): Class timetable map.
            faculty_avail_map (Dict): Faculty availability details.
            constraints (Dict): Global constraints.
            population_size (int): Size of population.
            generations (int): Generations count.

        Returns:
            Dict: The optimized timetable schedule map.
        """
        logger.info("Initializing Genetic Algorithm Optimization.")

        # If schedule is empty or invalid, return it directly
        if not schedule:
            return schedule

        population = [copy.deepcopy(schedule) for _ in range(population_size)]
        
        # Mutate the initial population except the first one (elite)
        for i in range(1, population_size):
            population[i] = cls._mutate(population[i], constraints)

        best_schedule = copy.deepcopy(schedule)
        best_fitness = cls._calculate_fitness(best_schedule, faculty_avail_map, constraints)

        for gen in range(generations):
            logger.debug(f"Generation {gen+1}/{generations} - Current Best Fitness: {best_fitness}")
            new_population = []

            # 1. Selection & Reproduction
            population.sort(key=lambda x: cls._calculate_fitness(x, faculty_avail_map, constraints), reverse=True)
            
            # Keep elite
            new_population.append(copy.deepcopy(population[0]))
            new_population.append(copy.deepcopy(population[1]))

            # Crossover & Mutate
            while len(new_population) < population_size:
                parent_a = random.choice(population[:5])
                parent_b = random.choice(population[:5])
                child = cls._crossover(parent_a, parent_b, constraints)
                child = cls._mutate(child, constraints)
                new_population.append(child)

            population = new_population
            
            # Check if we found a better individual
            current_best = population[0]
            current_fitness = cls._calculate_fitness(current_best, faculty_avail_map, constraints)
            if current_fitness > best_fitness:
                best_fitness = current_fitness
                best_schedule = copy.deepcopy(current_best)

        logger.info(f"Genetic Algorithm optimization complete. Final Best Fitness: {best_fitness}")
        return best_schedule

    @classmethod
    def _calculate_fitness(
        cls,
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        faculty_avail_map: Dict[str, str],
        constraints: Dict[str, Any]
    ) -> float:
        """
        Calculates fitness score. Higher is better.
        Hard clashes: penalty -1000
        Gaps: penalty -10 per gap
        Faculty overload (> max consec): penalty -50
        """
        score = 0.0
        working_days = [d.strip() for d in str(constraints.get("working_days", "Monday,Tuesday,Wednesday,Thursday,Friday")).split(",") if d.strip()]
        periods_per_day = int(constraints.get("periods_per_day", 7))
        lunch_break = int(constraints.get("lunch_break", 4))
        break_period = int(constraints.get("break_period", 2))
        max_consec = int(constraints.get("max_consecutive_classes", 3))

        # Re-verify faculty clashes
        faculty_schedule = {}
        for class_name, days_data in schedule.items():
            for day in working_days:
                for period in range(1, periods_per_day + 1):
                    entry = days_data[day][period]
                    if entry:
                        fac_name = entry["faculty"]
                        if fac_name not in faculty_schedule:
                            faculty_schedule[fac_name] = {}
                        if day not in faculty_schedule[fac_name]:
                            faculty_schedule[fac_name][day] = {}
                        
                        if period in faculty_schedule[fac_name][day]:
                            score -= 1000.0
                        faculty_schedule[fac_name][day][period] = class_name

        # Calculate student idle gaps
        for class_name, days_data in schedule.items():
            for day in working_days:
                scheduled_periods = [p for p, entry in days_data[day].items() if entry is not None and p != lunch_break and p != break_period]
                if scheduled_periods:
                    min_p = min(scheduled_periods)
                    max_p = max(scheduled_periods)
                    for p in range(min_p, max_p + 1):
                        if p == lunch_break or p == break_period:
                            continue
                        if days_data[day][p] is None:
                            score -= 10.0

        # Faculty consecutive workload penalty
        for fac_name, days_data in faculty_schedule.items():
            for day, periods_data in days_data.items():
                consec_count = 0
                sorted_periods = sorted(list(periods_data.keys()))
                for idx, p in enumerate(sorted_periods):
                    if idx == 0:
                        consec_count = 1
                    else:
                        if p == sorted_periods[idx - 1] + 1:
                            consec_count += 1
                        else:
                            consec_count = 1
                    if consec_count > max_consec:
                        score -= 50.0

        return score

    @classmethod
    def _mutate(
        cls,
        schedule: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        constraints: Dict[str, Any]
    ) -> Dict[str, Dict[str, Dict[int, Dict[str, Any]]]]:
        """
        Mutation operator: swaps two random periods of a class on a random day.
        """
        mutated = copy.deepcopy(schedule)
        classes = list(mutated.keys())
        if not classes:
            return mutated

        class_name = random.choice(classes)
        working_days = [d.strip() for d in str(constraints.get("working_days", "Monday,Tuesday,Wednesday,Thursday,Friday")).split(",") if d.strip()]
        day = random.choice(working_days)
        
        periods_per_day = int(constraints.get("periods_per_day", 7))
        lunch_break = int(constraints.get("lunch_break", 4))
        break_period = int(constraints.get("break_period", 2))

        valid_periods = [p for p in range(1, periods_per_day + 1) if p != lunch_break and p != break_period]
        if len(valid_periods) >= 2:
            p1, p2 = random.sample(valid_periods, 2)
            temp = mutated[class_name][day][p1]
            mutated[class_name][day][p1] = mutated[class_name][day][p2]
            mutated[class_name][day][p2] = temp

        return mutated

    @classmethod
    def _crossover(
        cls,
        parent_a: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        parent_b: Dict[str, Dict[str, Dict[int, Dict[str, Any]]]],
        constraints: Dict[str, Any]
    ) -> Dict[str, Dict[str, Dict[int, Dict[str, Any]]]]:
        """
        Crossover operator: swaps full day schedules between parents for each class.
        """
        child = copy.deepcopy(parent_a)
        working_days = [d.strip() for d in str(constraints.get("working_days", "Monday,Tuesday,Wednesday,Thursday,Friday")).split(",") if d.strip()]
        
        for class_name in child.keys():
            for day in working_days:
                if random.random() > 0.5:
                    child[class_name][day] = copy.deepcopy(parent_b[class_name][day])

        return child
