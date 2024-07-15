// ==UserScript==
// @name         DuChinese Exercises Beta
// @namespace    http://tampermonkey.net/
// @version      2024-06-28
// @description  comprehension exercises beta
// @author       Frithjof, Sinamon AB
// @match        https://duchinese.net/lessons/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=duchinese.net
// @grant        none
// ==/UserScript==

(async () => {
    "use strict";

    const rootPath = "https://sinamonab.github.io/exercises-experiment";

    // https://stackoverflow.com/a/61511955/2766231
    function waitForElement(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }
            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    // Include jQuery
    const script = document.createElement("script");
    script.src = "//cdnjs.cloudflare.com/ajax/libs/jquery/1.12.4/jquery.min.js";
    document.getElementsByTagName("head")[0].appendChild(script);
    await new Promise((resolve) => {
        script.onload = resolve;
    });

    // Inject CSS and additional Javascript
    $("head").first().append(`<link rel="stylesheet" type="text/css" href="${rootPath}/du-exercises.css">`);
    await $.getScript("//code.jquery.com/ui/1.13.3/jquery-ui.js");

    const hashEmail = function(email) {
        let hash = 0,
        i, chr;
        if (email.length === 0) return hash;
        for (i = 0; i < email.length; i++) {
            chr = email.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    const reloadExercises = async () => {
        // Wait for page to load
        await waitForElement(".lesson-content");

        // Get control group
        let exerciseSet = undefined;
        const userEmail = $("#vue-root").data("email");
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("exercise-set")) {
            // If URL contains exercise-set=XX, override control group
            exerciseSet = urlParams.get("exercise-set");
        } else {
            if (userEmail === undefined) {
                console.log("User not logged in, not showing exercises.");
                return;
            }
            exerciseSet = Math.abs(hashEmail(userEmail) % 2) === 0 ? "reading" : "grammar";
        }

        // Get the lesson ID from the URL
        let dataPath;
        let lessonId;
        if (window.location.pathname.startsWith("/lessons/")) {
            if (window.location.pathname.startsWith("/lessons/courses/")) {
                // URL: /lessons/courses/114-the-monkey-s-paw?chapter=1
                const courseId = window.location.pathname.split("/")[3].split("-")[0];
                const chapter = new URLSearchParams(window.location.search).get("chapter");
                lessonId = `courses/${courseId}-${chapter}`;
            } else {
                // URL: /lesson/1580-the-addiction-economy-of-milk-tea
                lessonId = "lessons/" + window.location.pathname.split("/")[2].split("-")[0];
            }
            dataPath = `${rootPath}/data/${lessonId}-${exerciseSet}.js`;
            console.log(`Loading exercises for ${lessonId} in set ${exerciseSet}`);
        } else {
            console.log("No exercise data found");
            return;
        }

        // Load exercise JSON file into variable `exerciseList`
        await $.getScript(dataPath);

        // Cleanup previous exercises
        $(".exercises-header, .exercises-body").remove();

        // Inject exercise section
        const exercisesHeaderEl = $(`
            <div class="exercises-header">
                <div class="col-12 col-sm-10 offset-sm-1 col-md-10 offset-md-1 col-lg-8 offset-lg-2 col-xl-6 offset-xl-3">
                    <div class="heading">Exercises</div>
                    <div class="exercise-progress exercise-progress-testing">
                        <div>
                            <ol class="progress-icons">
                                ${exerciseList.map((exerciseJson, exerciseNum) => {
                                    return `<li class="progress-icon ahead" data-exercise-num="${exerciseNum}"></li>`;
                                }).join(" ")}
                            </ol>
                        </div>
                        <div>
                            <span class="progress-text">4/5</span>
                        </div>
                    </div>
                    <div class="exercise-progress exercise-progress-summary">
                        <div>
                            <span>Summary</span>
                        </div>
                    </div>
                </div>
            </div>`);
        const exercisesBodyEl = $(`
            <div class="exercises-body">
                <div class="col-12 col-sm-10 offset-sm-1 col-md-10 offset-md-1 col-lg-8 offset-lg-2 col-xl-6 offset-xl-3" id="du-exercise-screen">
                    <div class="clearfix"></div>
                    <div class="exercises">
                    </div>
                </div>
            </div>`);
        $(".lesson-content").first().after(exercisesBodyEl).after(exercisesHeaderEl).after("<hr>");
        const exercisesEl = exercisesBodyEl.find(".exercises");
        const testingHeaderEl = exercisesHeaderEl.find(".exercise-progress-testing");
        const summaryHeaderEl = exercisesHeaderEl.find(".exercise-progress-summary");
        const progressIconsEl = exercisesHeaderEl.find(".progress-icons");
        const progressTextEl = exercisesHeaderEl.find(".progress-text");

        // Stop scrolling of "sticky header" past exercise section
        $(window).scroll(function () {
            const containerTop = exercisesHeaderEl.offset().top - $(window).scrollTop() - $(".du-translation-fixed").height();
            const navbarHeight = $(".navbar:not(.hidden)").height();
            $(".lesson-content-container .du-translation-fixed").css("top", Math.min(navbarHeight, containerTop));
        });

        const CompletionStatus = {
            Correct: "correct",
            Wrong: "wrong",
            Skipped: "skipped",
            Current: "current",
            Ahead: "ahead"
        }

        let state = {
            "lesson": lessonId,
            "exercise_set": exerciseSet,
            "current_question_num": 0,
            "question_completion_status": Array(exerciseList.length).fill(CompletionStatus.Ahead)
        }
        state.question_completion_status[state.current_question_num] = CompletionStatus.Current;

        const sendExerciseEvent = (eventName, exerciseJson, eventData) => {
            const properties = {
                "user_email_hash": hashEmail(userEmail),
                "lesson": state.lesson,
                "exercise_set": state.exercise_set,
                "exercise_num": exerciseJson.num,
                "exercise_type": exerciseJson.question_type
            };
            if (exerciseJson.start_time !== undefined) {
                properties["time_in_exercise_msec"] = new Date().getTime() - exerciseJson.start_time;
            }
            Object.assign(properties, eventData);
            gtag("event", eventName, properties);
            console.log(properties);
        };

        const resetToFirstExercise = () => {
            exercisesEl.find(".exercise").remove();
            exerciseList.forEach((exerciseJson, exerciseNum) => {
                exerciseJson.num = exerciseNum;
                makeExerciseEl(exerciseJson);
            });
            state.current_question_num = 0;
            state.question_completion_status = Array(exerciseList.length).fill(CompletionStatus.Ahead);
            state.question_completion_status[state.current_question_num] = CompletionStatus.Current;
            exerciseList[state.current_question_num].start_time = new Date().getTime();
            updateExercisesBasedOnState();
        }
        const updateExercisesBasedOnState = () => {
            exercisesEl.find(".exercise, .exercise-summary").hide();
            if (state.current_question_num < exerciseList.length) {
                // show exercise
                exerciseList[state.current_question_num].el.show();
                // update header
                testingHeaderEl.show();
                progressIconsEl.find(".progress-icon").each((_, progressIconEl) => {
                    progressIconEl = $(progressIconEl);
                    const completionStatus = state.question_completion_status[progressIconEl.data("exercise-num")];
                    progressIconEl.attr("class", `progress-icon ${completionStatus}`);
                });
                progressTextEl.text(`${state.current_question_num + 1}/${exerciseList.length}`);
                summaryHeaderEl.hide();
            } else {
                // show summary
                summaryEl.show();
                const questionsCompletedText = [];
                const numReadingQuestionsCompleted = exerciseList.filter((exercise) => exercise.question_type === "reading").length;
                // iterate over both question types
                for (const questionType of ["reading", "grammar"]) {
                    const numQuestionsCompleted = exerciseList.filter((exercise) => exercise.question_type === questionType).length;
                    const wrapperEl = summaryEl.find(`.summary-stats-wrapper.${questionType}`);
                    if (numQuestionsCompleted > 0) {
                        questionsCompletedText.push(`${numQuestionsCompleted} ${questionType} exercise${numQuestionsCompleted > 1 ? "s" : ""}`);
                        wrapperEl.show();
                        wrapperEl.find(".summary-stats .correct .stats-amount").text(state.question_completion_status.filter((status) => status === CompletionStatus.Correct).length);
                        wrapperEl.find(".summary-stats .wrong .stats-amount").text(state.question_completion_status.filter((status) => status === CompletionStatus.Wrong).length);
                        wrapperEl.find(".summary-stats .skipped .stats-amount").text(state.question_completion_status.filter((status) => status === CompletionStatus.Skipped).length);
                    } else {
                        wrapperEl.hide();
                    }
                }
                summaryEl.find(".summary-text span").text(`You completed ${questionsCompletedText.join(" and ")}.`);

                // update header
                summaryHeaderEl.show();
                testingHeaderEl.hide();
            }
        }
        const completeExercise = (exerciseJson, completionStatus) => {
            state.question_completion_status[state.current_question_num] = completionStatus;
            if (state.current_question_num + 1 < exerciseList.length) {
                state.current_question_num += 1;
                exerciseList[state.current_question_num].start_time = new Date().getTime();
                state.question_completion_status[state.current_question_num] = CompletionStatus.Current;
            } else {
                // show summary screen
                state.current_question_num = exerciseList.length;
            }
            updateExercisesBasedOnState();
        };

        // Add HTML and functionality for each exercise
        const ExerciseState = {
            Initial: "initial",
            Answered: "answered",
            ClickCheckWithoutSelection: "click-check-without-selection",
            Checking: "checking"
        }

        const updateExerciseState = (exerciseJson, newState) => {
            // reset state
            exerciseJson.el.removeClass(`state-${exerciseJson.state} correct wrong`);
            exerciseJson.el.find(".btn").off("click");
            if (typeof exerciseJson.el.find(".given-answer").sortable() !== "undefined") {
                exerciseJson.el.find(".given-answer").sortable("destroy");
            }
            exerciseJson.el.find(".check-btn").text("Check");

            const initial = () => {
                // reading
                exerciseJson.el.find(".reading-choice-btn").click((e) => {
                    exerciseJson.el.find(".reading-choice-btn").removeClass("selected");
                    $(e.target).addClass("selected");
                    updateExerciseState(exerciseJson, ExerciseState.Answered);
                });

                // grammar
                exerciseJson.el.find(".word-bank-btn").click((e) => {
                    const el = $(e.target);
                    if (el.hasClass("disabled")) {
                        return;
                    }
                    const word = el.data("word");
                    const wordSlot = exerciseJson.el.find(".word-slot-btn.empty:first");
                    wordSlot.find(".word-span").text(word);
                    wordSlot.data("word", word);
                    wordSlot.removeClass("empty");
                    $(e.target).addClass("disabled");
                    if (exerciseJson.el.find(".word-slot-btn.empty").length === 0) {
                        updateExerciseState(exerciseJson, ExerciseState.Answered);
                    }
                });
                exerciseJson.el.find(".word-slot-btn").click((e) => {
                    const el = $(e.target);
                    if (el.hasClass("empty")) {
                        return;
                    }
                    const word = el.data("word");
                    const wordBank = exerciseJson.el.find(`.word-bank-btn[data-word="${word}"]`).first();
                    wordBank.removeClass("disabled");
                    el.find(".word-span").text("?");
                    el.addClass("empty");
                    // move clicked word slot to end of list, i.e. after the last non-empty slot
                    el.parent().insertAfter(exerciseJson.el.find(".given-answer .word-slot-btn:not(.empty)").last().parent());

                    if (exerciseJson.el.find(".word-slot-btn.empty").length > 0) {
                        updateExerciseState(exerciseJson, ExerciseState.Initial);
                    }
                });
                exerciseJson.el.find(".given-answer").sortable({
                    items: "li:has(.word-slot-btn:not(.empty))",
                    cancel: "",
                    tolerance: "pointer"
                });

                // general
                exerciseJson.el.find(".skip-btn").click(() => {
                    sendExerciseEvent("exercise_skip_single", exerciseJson, {});
                    completeExercise(exerciseJson, CompletionStatus.Skipped);
                });
            };
            switch (newState) {
                case ExerciseState.Initial:
                case ExerciseState.ClickCheckWithoutSelection:
                    initial();
                    exerciseJson.el.find(".check-btn").click(() => {
                        updateExerciseState(exerciseJson, ExerciseState.ClickCheckWithoutSelection);
                    });
                    break;
                case ExerciseState.Answered:
                    initial();
                    exerciseJson.el.find(".check-btn").click(() => {
                        updateExerciseState(exerciseJson, ExerciseState.Checking);
                    });
                    break;
                case ExerciseState.Checking:
                    let correct = undefined;
                    let givenAnswerAnalyticsData = undefined;
                    switch (exerciseJson.question_type) {
                        case "reading":
                            const selectedOptionNum = exerciseJson.el.find(".reading-choice-btn.selected").data("option-num");
                            givenAnswerAnalyticsData = selectedOptionNum;
                            correct = selectedOptionNum === exerciseJson.solution;
                            exerciseJson.el.find(`.reading-choice-btn[data-option-num=${exerciseJson.solution}]`).addClass("correct");
                            if (!correct) {
                                exerciseJson.el.find(".reading-choice-btn.selected").addClass("wrong");
                            }
                            exerciseJson.el.find(".reading-choice-btn").addClass("disabled");
                            break;
                        case "grammar":
                            const givenAnswer = exerciseJson.el.find(".given-answer .word-btn:not(.empty)").map((_, el) => $(el).data("word")).get();
                            givenAnswerAnalyticsData = givenAnswer.join("|");
                            const incorrectIndicesPerSolution = exerciseJson.solutions.map((solution) => {
                                return solution.map((word, wordIndex) => word !== givenAnswer[wordIndex] ? wordIndex : undefined).filter((i) => i !== undefined);
                            });
                            const closestSolutionNum = incorrectIndicesPerSolution.map((indices) => indices.length).reduce((iMin, x, i, arr) => x < arr[iMin] ? i : iMin, 0);
                            const closestSolutionMistakes = incorrectIndicesPerSolution[closestSolutionNum];
                            correct = closestSolutionMistakes.length === 0;
                            if (correct) {
                                exerciseJson.el.find(".solution-text").text(`That's a correct order!`);
                            } else {
                                exerciseJson.el.find(".solution-text").text(`Correct order: ${exerciseJson.solutions[closestSolutionNum].join("")}`);
                            }

                            // mark correct and wrong words
                            exerciseJson.el.find(".given-answer .word-btn").each((wordIndex, el) => {
                                $(el).addClass(closestSolutionMistakes.includes(wordIndex) ? "wrong" : "correct");
                            });
                            break;
                        default:
                            break;
                    }

                    sendExerciseEvent("exercise_complete_single", exerciseJson, {"answer_given": givenAnswerAnalyticsData, "answered_correctly": correct});

                    const completionStatus = correct ? CompletionStatus.Correct : CompletionStatus.Wrong;
                    state.question_completion_status[state.current_question_num] = completionStatus;
                    updateExercisesBasedOnState();

                    exerciseJson.el.find(".check-btn").text("Next");
                    exerciseJson.el.addClass(completionStatus);
                    exerciseJson.el.find(".check-btn").click(() => {
                        completeExercise(exerciseJson, completionStatus);
                    });
                    break;
            }
            exerciseJson.el.addClass(`state-${newState}`);

            exerciseJson.state = newState;
        };

        // Populate exercise list
        const makeExerciseEl = (exerciseJson) => {
            let instruction = "";
            let task = "";
            let explanation = "";
            switch (exerciseJson.question_type) {
                case "reading":
                    instruction = `
                        <div class="exercise-instruction">
                            <div>
                                <span class="exercise-type">Reading Comprehension</span>
                            </div>
                            <span>Choose the correct answer according to the reading.</span>
                        </div>`;
                    task = `
                        <div class="exercise-task">
                            <span class="question">${exerciseJson.question}</span>
                            <ol class="answer-options">
                                ${exerciseJson.answer_options.map((option, optionNum) => {
                        return `<li><button type="button" class="btn exercise-btn reading-choice-btn" data-option-num="${optionNum}">${option}</button></li>`;
                    }).join("")}
                            </ol>
                        </div>
                        <div class="exercise-instruction select-option-first-text">
                            <span>Click on the answer first.</span>
                        </div>`;
                    break;
                case "grammar":
                    instruction = `
                        <div class="exercise-instruction">
                            <div>
                                <span class="exercise-type">Grammar</span>
                            </div>
                            <span>Translate the English sentence using a correct grammar pattern.</span>
                        </div>`;
                    task = `
                        <div class="exercise-task">
                            <span class="english">${exerciseJson.english}</span>
                            <ol class="given-answer word-list">
                                ${exerciseJson.word_bank.map((word) => {
                                    return `<li><button type="button" class="btn word-btn exercise-btn word-slot-btn empty" data-word=""><span class="word-span">?</span></button></li>`;
                                }).join("")}
                                ${exerciseJson.prefilled_postfix.map((word) => {
                                    return `<li><button type="button" class="btn word-btn exercise-btn prefilled-word-slot-btn disabled" data-word="${word}"><span class="word-span">${word}</span></button></li>`;
                                }).join("")}
                                <li class="solution correct"><img class="solution-icon" src="${rootPath}/correct-icon.svg"></li>
                                <li class="solution wrong"><img class="solution-icon" src="${rootPath}/wrong-icon.svg"></li>
                            </ol>
                            <ol class="word-bank word-list">
                                ${exerciseJson.word_bank.map((word) => {
                                    return `<li><button type="button" class="btn word-btn exercise-btn word-bank-btn" data-word="${word}"><span class="word-span">${word}</span></button></li>`;
                                }).join("")}
                            </ol>
                        </div>
                        <div class="exercise-instruction select-option-first-text">
                            <span>Click on all words in the word list to form the translation of the English sentence.</span>
                        </div>
                        <div class="exercise-instruction solution">
                            <span class="solution-text"></span>
                        </div>`;
                    explanation = `
                        <div class="exercise-explanation">
                            Connected grammar article:
                            <a href="/grammar/${exerciseJson.grammar_point.slug}" target="_blank">${exerciseJson.grammar_point.name}</a>
                        </div>`;
                    break;
                default:
                    instruction = `Unknown question type: ${exerciseJson.question_type}`;
                    break;
            }
            exerciseJson.el = $(`
                <div class="exercise">
                    <form>
                        ${instruction}
                        ${task}
                        <div class="exercise-controls form-group">
                            <button type="button" class="btn check-btn">Check</button>
                            <button type="button" class="btn skip-btn">
                                <img src="${rootPath}/skip-button.svg">
                                Skip
                            </button>
                        </div>
                        ${explanation}
                    </form>
                </div>`);
            exercisesEl.append(exerciseJson.el);
            exerciseJson.el.hide();
            updateExerciseState(exerciseJson, ExerciseState.Initial);
        };

        const makeSummaryEl = () => {
            let grammarPoints = [];
            for (const exerciseJson of exerciseList) {
                if (exerciseJson.question_type !== "grammar" || exerciseJson.grammar_point === undefined) {
                    continue;
                }
                if (grammarPoints.map((g) => g.slug).includes(exerciseJson.grammar_point.slug)) {
                    continue;
                }
                grammarPoints.push(exerciseJson.grammar_point);
            }
            const grammarExplanation = `
                <div class="exercise-explanation">
                    Connected grammar articles:
                    ${grammarPoints.map((g) => { return `<a href="/grammar/${g.slug}" target="_blank">${g.name}</a>`; }).join(", ")}
                </div>`;
            const makeSummaryStats = (questionType, title, explanation) => {
                return `<div class="summary-stats-wrapper ${questionType}">
                    <span class="exercise-type">${title}</span>
                    <div class="summary-stats">
                        <div class="correct">
                            <div class="stats-type">
                                <img class="stats-icon" src="${rootPath}/stats-correct.svg" alt="">
                                <span class="stats-text">Correct</span>
                            </div>
                            <span class="stats-amount">2</span>
                        </div>
                        <div class="wrong">
                            <div class="stats-type">
                                <img class="stats-icon" src="${rootPath}/stats-wrong.svg" alt="">
                                <span class="stats-text">Wrong</span>
                            </div>
                            <span class="stats-amount">1</span>
                        </div>
                        <div class="skipped">
                            <div class="stats-type">
                                <img class="stats-icon" src="${rootPath}/stats-skipped.svg" alt="">
                                <span class="stats-text">Skipped</span>
                            </div>
                            <span class="stats-amount">0</span>
                        </div>
                    </div>
                    ${explanation}
                </div>`;
            }
            const el = $(`
                <div class="exercise-summary">
                    <form>
                        <div class="summary-text">
                            <span>You completed 2 comprehension questions.</span>
                        </div>
                        ${makeSummaryStats("reading", "Reading Comprehension", "")}
                        ${makeSummaryStats("grammar", "Grammar", grammarExplanation)}
                        <div class="exercise-controls form-group">
                            <button type="button" class="btn try-again-btn">Try again</button>
                        </div>
                        <div class="summary-feedback">
                            Please give us feedback on our experimental exercises feature!
                            <iframe src="https://docs.google.com/forms/d/e/1FAIpQLScK2DPMf9RmVZmzbRAlirA_NI5FSnoX4XxxiDinc1dFSkws_Q/viewform?embedded=true&entry.1306397561=${userEmail}" width="100%" height="1000px" frameborder="0" marginheight="0" marginwidth="0" scrolling="no">Loading feedback form ...</iframe>
                        </div>
                    </form>
                </div>`);
            exercisesEl.append(el);
            el.hide();
            el.find(".try-again-btn").click(() => {
                sendExerciseEvent("exercise_try_again", exerciseList[0], {});
                resetToFirstExercise();
            });
            return el;
        };
        const summaryEl = makeSummaryEl();

        resetToFirstExercise();
    };

    reloadExercises();
    $(navigation).on("navigate", () => {
        reloadExercises();
    });
})();